import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";

function trimValue(value) {
  return value == null ? "" : String(value).trim();
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeMoney(value) {
  const raw = trimValue(value).replace(",", ".");
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

function getDefaultShippingCost() {
  return normalizeMoney(process.env.DEFAULT_SHIPPING_COST || "");
}

function getFeedUrl(shop) {
  const base = trimValue(process.env.SHOPIFY_APP_URL).replace(/\/$/, "");
  if (!base) return `/feed/${shop}.xml`;
  return `${base}/feed/${shop}.xml`;
}

function getPublicProductUrl(shop, product) {
  if (trimValue(product.onlineStoreUrl)) return trimValue(product.onlineStoreUrl);
  return `https://${shop}/products/${product.handle}`;
}

function getFirstImageUrl(product) {
  return trimValue(product?.images?.edges?.[0]?.node?.url);
}

function getFirstVariant(product) {
  return product?.variants?.edges?.[0]?.node || null;
}

function mapProductForFeed(product, shop) {
  const variant = getFirstVariant(product);

  const category =
    trimValue(product?.categoryOverride?.value) || trimValue(product?.productType);

  const ean =
    trimValue(product?.eanOverride?.value) ||
    trimValue(product?.gtinOverride?.value) ||
    trimValue(variant?.barcode);

  const sku = trimValue(variant?.sku);

  const quantity =
    Number.isFinite(Number(product?.totalInventory))
      ? String(Number(product.totalInventory))
      : "";

  const shippingCost =
    normalizeMoney(product?.shippingCost?.value) || getDefaultShippingCost();

  const price = normalizeMoney(variant?.price);

  const missing = [];
  if (!category) missing.push("Categoria");
  if (!ean) missing.push("EAN");
  if (!shippingCost) missing.push("Spese di spedizione");
  if (!sku) missing.push("SKU");
  if (quantity === "") missing.push("Quantità");

  if (!price) missing.push("Prezzo");

  const mapped = {
    name: trimValue(product?.title),
    description: trimValue(product?.description) || trimValue(product?.title),
    url: getPublicProductUrl(shop, product),
    image: getFirstImageUrl(product),
    price,
    brand: trimValue(product?.vendor) || "N/D",
    category,
    ean,
    shippingCost,
    sku,
    quantity,
    availability: Number(quantity) > 0 ? "in stock" : "out of stock",
  };

  if (missing.length > 0) {
    return {
      included: false,
      error: {
        name: mapped.name || "Prodotto senza nome",
        sku: mapped.sku || "-",
        missing,
      },
    };
  }

  return {
    included: true,
    item: mapped,
  };
}

async function fetchAllActiveProducts(admin) {
  const allProducts = [];
  let after = null;
  let hasNextPage = true;

  const query = `#graphql
    query TrovaprezziProducts($after: String) {
      products(first: 100, after: $after, query: "status:active") {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            handle
            description
            vendor
            productType
            status
            totalInventory
            onlineStoreUrl

            categoryOverride: metafield(namespace: "custom", key: "trovaprezzi_category") {
              value
            }

            shippingCost: metafield(namespace: "custom", key: "shipping_cost") {
              value
            }

            eanOverride: metafield(namespace: "custom", key: "ean") {
              value
            }

            gtinOverride: metafield(namespace: "custom", key: "gtin") {
              value
            }

            images(first: 1) {
              edges {
                node {
                  url
                }
              }
            }

            variants(first: 1) {
              edges {
                node {
                  sku
                  barcode
                  price
                }
              }
            }
          }
        }
      }
    }
  `;

  while (hasNextPage) {
    const response = await admin.graphql(query, {
      variables: { after },
    });

    const payload = await response.json();

    if (payload?.errors?.length) {
      throw new Error(payload.errors.map((e) => e.message).join(" | "));
    }

    const connection = payload?.data?.products;
    if (!connection) {
      throw new Error("Risposta Shopify non valida durante il caricamento prodotti.");
    }

    for (const edge of connection.edges || []) {
      if (edge?.node) allProducts.push(edge.node);
    }

    hasNextPage = Boolean(connection?.pageInfo?.hasNextPage);
    after = connection?.pageInfo?.endCursor || null;
  }

  return allProducts;
}

function buildXml(items) {
  const rows = items
    .map((item) => {
      return `  <product>
    <name>${escapeXml(item.name)}</name>
    <description>${escapeXml(item.description)}</description>
    <url>${escapeXml(item.url)}</url>
    <image>${escapeXml(item.image)}</image>
    <price>${escapeXml(item.price)}</price>
    <brand>${escapeXml(item.brand)}</brand>
    <category>${escapeXml(item.category)}</category>
    <ean>${escapeXml(item.ean)}</ean>
    <shipping_cost>${escapeXml(item.shippingCost)}</shipping_cost>
    <sku>${escapeXml(item.sku)}</sku>
    <quantity>${escapeXml(item.quantity)}</quantity>
    <availability>${escapeXml(item.availability)}</availability>
  </product>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<products>
${rows}
</products>`;
}

async function persistFeedState({ shop, xml, includedCount, excludedCount, feedStatus }) {
  const now = new Date();

  await prisma.feedState.upsert({
    where: { shop },
    update: {
      feedStatus,
      feedUrl: getFeedUrl(shop),
      includedCount,
      excludedCount,
      xmlContent: xml,
      lastGeneratedAt: now,
    },
    create: {
      shop,
      feedStatus,
      feedUrl: getFeedUrl(shop),
      includedCount,
      excludedCount,
      xmlContent: xml,
      lastGeneratedAt: now,
    },
  });

  return now.toISOString();
}

export async function generateFeedForShop(shop) {
  const cleanShop = trimValue(shop);
  if (!cleanShop) throw new Error("Shop mancante.");

  const { admin } = await unauthenticated.admin(cleanShop);
  const products = await fetchAllActiveProducts(admin);

  const included = [];
  const errors = [];

  for (const product of products) {
    const mapped = mapProductForFeed(product, cleanShop);
    if (mapped.included) included.push(mapped.item);
    else errors.push(mapped.error);
  }

  const xml = buildXml(included);

  const generatedAt = await persistFeedState({
    shop: cleanShop,
    xml,
    includedCount: included.length,
    excludedCount: errors.length,
    feedStatus:
      errors.length > 0
        ? "Generato con esclusioni"
        : "Generato correttamente",
  });

  return {
    shop: cleanShop,
    xml,
    errors,
    generatedAt,
    includedCount: included.length,
    excludedCount: errors.length,
    feedUrl: getFeedUrl(cleanShop),
  };
}

export async function getFeedDiagnosticsForShop(shop) {
  const cleanShop = trimValue(shop);
  if (!cleanShop) throw new Error("Shop mancante.");

  const { admin } = await unauthenticated.admin(cleanShop);
  const products = await fetchAllActiveProducts(admin);

  const errors = [];

  for (const product of products) {
    const mapped = mapProductForFeed(product, cleanShop);
    if (!mapped.included) errors.push(mapped.error);
  }

  const state = await prisma.feedState.findUnique({
    where: { shop: cleanShop },
  });

  return {
    errors,
    generatedAt: state?.lastGeneratedAt?.toISOString?.() || null,
    feedUrl: getFeedUrl(cleanShop),
    includedCount: state?.includedCount ?? null,
    excludedCount: state?.excludedCount ?? errors.length,
    status:
      errors.length > 0
        ? "Generato con esclusioni"
        : "Generato correttamente",
  };
}
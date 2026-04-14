import prisma from "../db.server";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeMoney(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "0.00";
  return number.toFixed(2);
}

function normalizeQuantity(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.floor(number));
}

export function getDefaultShippingCost() {
  return normalizeMoney(process.env.DEFAULT_SHIPPING_COST ?? "0.00");
}

function getProductImage(product) {
  return product?.images?.edges?.[0]?.node?.url ?? "";
}

function getProductSku(product) {
  return product?.variants?.edges?.[0]?.node?.sku?.trim?.() ?? "";
}

function getProductBarcode(product) {
  return product?.variants?.edges?.[0]?.node?.barcode?.trim?.() ?? "";
}

function getProductPrice(product) {
  return normalizeMoney(product?.variants?.edges?.[0]?.node?.price ?? 0);
}

function getProductQuantity(product) {
  const variantQty = product?.variants?.edges?.[0]?.node?.inventoryQuantity;
  if (variantQty !== null && variantQty !== undefined) {
    return normalizeQuantity(variantQty);
  }
  return normalizeQuantity(product?.totalInventory ?? 0);
}

function getProductCategory(product) {
  const productType = product?.productType?.trim?.() ?? "";
  return productType;
}

function getProductUrl(product, shopPrimaryDomainUrl) {
  if (product?.onlineStoreUrl) return product.onlineStoreUrl;
  if (!shopPrimaryDomainUrl) return "";
  return `${shopPrimaryDomainUrl.replace(/\/$/, "")}/products/${product.handle}`;
}

function validateProduct(product, shippingCost, shopPrimaryDomainUrl) {
  const errors = [];

  const category = getProductCategory(product);
  const ean = getProductBarcode(product);
  const sku = getProductSku(product);
  const quantity = getProductQuantity(product);
  const url = getProductUrl(product, shopPrimaryDomainUrl);

  if (!category) errors.push("Categoria mancante");
  if (!ean) errors.push("EAN mancante");
  if (!shippingCost) errors.push("Spese di spedizione mancanti");
  if (!sku) errors.push("SKU mancante");
  if (quantity <= 0) errors.push("Quantità non valida");
  if (!url) errors.push("URL prodotto mancante");

  return {
    isValid: errors.length === 0,
    errors,
    derived: {
      category,
      ean,
      sku,
      quantity,
      url,
      price: getProductPrice(product),
      image: getProductImage(product),
      shippingCost,
    },
  };
}

export async function loadCatalogData(admin) {
  const response = await admin.graphql(
    `#graphql
      query TrovaprezziCatalog {
        shop {
          name
          primaryDomain {
            url
          }
        }
        products(first: 100) {
          edges {
            node {
              id
              title
              handle
              vendor
              productType
              status
              totalInventory
              onlineStoreUrl
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
                    price
                    barcode
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }
      }
    `
  );

  const json = await response.json();

  if (json?.errors?.length) {
    throw new Error(json.errors[0]?.message || "Errore GraphQL Shopify");
  }

  const products = json?.data?.products?.edges?.map((edge) => edge.node) ?? [];
  const shop = json?.data?.shop ?? null;

  return {
    shop,
    products,
  };
}

export function buildFeedAnalysis(products, shopPrimaryDomainUrl) {
  const shippingCost = getDefaultShippingCost();

  const includedProducts = [];
  const excludedProducts = [];

  for (const product of products) {
    const validation = validateProduct(product, shippingCost, shopPrimaryDomainUrl);

    const baseItem = {
      id: product.id,
      title: product.title ?? "",
      handle: product.handle ?? "",
      vendor: product.vendor ?? "",
      status: product.status ?? "",
      productType: product.productType ?? "",
      image: validation.derived.image,
      url: validation.derived.url,
      sku: validation.derived.sku,
      ean: validation.derived.ean,
      quantity: validation.derived.quantity,
      price: validation.derived.price,
      shippingCost: validation.derived.shippingCost,
      category: validation.derived.category,
    };

    if (validation.isValid) {
      includedProducts.push(baseItem);
    } else {
      excludedProducts.push({
        ...baseItem,
        errors: validation.errors,
      });
    }
  }

  return {
    shippingCost,
    includedProducts,
    excludedProducts,
  };
}

export function buildXmlFeed(products) {
  const xmlItems = products
    .map((product) => {
      const availability = product.quantity > 0 ? "in stock" : "out of stock";

      return `
  <product>
    <name>${escapeXml(product.title)}</name>
    <description>${escapeXml(product.title)}</description>
    <url>${escapeXml(product.url)}</url>
    <image>${escapeXml(product.image)}</image>
    <price>${escapeXml(product.price)}</price>
    <brand>${escapeXml(product.vendor || "Senza marca")}</brand>
    <category>${escapeXml(product.category)}</category>
    <ean>${escapeXml(product.ean)}</ean>
    <shipping_cost>${escapeXml(product.shippingCost)}</shipping_cost>
    <sku>${escapeXml(product.sku)}</sku>
    <quantity>${escapeXml(product.quantity)}</quantity>
    <availability>${escapeXml(availability)}</availability>
  </product>`.trim();
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<products>
${xmlItems}
</products>`;
}

export async function saveFeedState({
  shop,
  feedUrl,
  xmlContent,
  includedCount,
  excludedCount,
  feedStatus,
}) {
  return prisma.feedState.upsert({
    where: { shop },
    update: {
      feedUrl,
      xmlContent,
      includedCount,
      excludedCount,
      feedStatus,
      lastGeneratedAt: new Date(),
    },
    create: {
      shop,
      feedUrl,
      xmlContent,
      includedCount,
      excludedCount,
      feedStatus,
      lastGeneratedAt: new Date(),
    },
  });
}

export async function getFeedState(shop) {
  return prisma.feedState.findUnique({
    where: { shop },
  });
}
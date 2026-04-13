import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";

const PRODUCTS_QUERY = `#graphql
  query FeedyPriceProducts($first: Int!) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          handle
          status
          vendor
          productType
          onlineStoreUrl
          featuredImage {
            url
          }
          variants(first: 1) {
            edges {
              node {
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
`;

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeProducts(rawProducts) {
  return rawProducts.map((product) => {
    const firstVariant = product?.variants?.edges?.[0]?.node || null;
    const price = Number(firstVariant?.price || 0);
    const image = product?.featuredImage?.url || "";
    const barcode = firstVariant?.barcode || "";
    const inventoryQuantity =
      typeof firstVariant?.inventoryQuantity === "number"
        ? firstVariant.inventoryQuantity
        : 0;

    const isIncluded =
      product?.status === "ACTIVE" && Boolean(image) && price > 0;

    return {
      title: product.title || "",
      handle: product.handle || "",
      vendor: product.vendor || "",
      productType: product.productType || "",
      onlineStoreUrl: product.onlineStoreUrl || "",
      image,
      price,
      barcode,
      inventoryQuantity,
      isIncluded,
      availability: inventoryQuantity > 0 ? "in stock" : "out of stock",
      category:
        product.productType?.trim() || product.vendor?.trim() || "Altro",
    };
  });
}

function buildXml(products) {
  const includedProducts = products.filter((product) => product.isIncluded);

  const xmlItems = includedProducts
    .map((product) => {
      const productUrl =
        product.onlineStoreUrl ||
        `https://example.com/products/${encodeURIComponent(product.handle)}`;

      return `  <product>
    <name>${escapeXml(product.title)}</name>
    <description>${escapeXml(product.title)}</description>
    <url>${escapeXml(productUrl)}</url>
    <image>${escapeXml(product.image)}</image>
    <price>${escapeXml(product.price.toFixed(2))}</price>
    <brand>${escapeXml(product.vendor || "Senza marca")}</brand>
    <gtin>${escapeXml(product.barcode)}</gtin>
    <category>${escapeXml(product.category)}</category>
    <availability>${escapeXml(product.availability)}</availability>
  </product>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<products>
${xmlItems}
</products>`;
}

async function fetchShopProducts(admin) {
  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first: 250 },
  });

  const responseJson = await response.json();
  const rawProducts =
    responseJson?.data?.products?.edges?.map((edge) => edge.node) || [];

  return normalizeProducts(rawProducts);
}

function buildFeedUrl(shop) {
  const appUrl = (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");
  return `${appUrl}/feed/${shop}.xml`;
}

export const loader = async ({ params }) => {
  const shop = params.shop;

  if (!shop) {
    return new Response("Missing shop parameter", { status: 400 });
  }

  const savedFeed = await prisma.feedState.findUnique({
    where: { shop },
  });

  if (savedFeed?.xmlContent) {
    return new Response(savedFeed.xmlContent, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const { admin } = await unauthenticated.admin(shop);
  const products = await fetchShopProducts(admin);
  const xmlContent = buildXml(products);

  const includedCount = products.filter((product) => product.isIncluded).length;
  const excludedCount = products.filter((product) => !product.isIncluded).length;
  const now = new Date();

  await prisma.feedState.upsert({
    where: { shop },
    update: {
      feedStatus: "Generato automaticamente",
      feedUrl: buildFeedUrl(shop),
      includedCount,
      excludedCount,
      xmlContent,
      lastGeneratedAt: now,
    },
    create: {
      shop,
      feedStatus: "Generato automaticamente",
      feedUrl: buildFeedUrl(shop),
      includedCount,
      excludedCount,
      xmlContent,
      lastGeneratedAt: now,
    },
  });

  return new Response(xmlContent, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
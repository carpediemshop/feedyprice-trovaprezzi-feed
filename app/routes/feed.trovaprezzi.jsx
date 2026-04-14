import { json } from "@remix-run/node";

export async function loader({ request }) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return new Response("Missing shop", { status: 400 });
  }

  try {
    const response = await fetch(
      `https://${shop}/admin/api/2025-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          query: `
          {
            products(first: 100) {
              edges {
                node {
                  title
                  handle
                  productType
                  vendor
                  status
                  totalInventory
                  variants(first: 1) {
                    edges {
                      node {
                        sku
                        price
                        barcode
                      }
                    }
                  }
                  images(first: 1) {
                    edges {
                      node {
                        url
                      }
                    }
                  }
                }
              }
            }
          }
          `,
        }),
      }
    );

    const data = await response.json();

    const products = data.data.products.edges;

    const validProducts = [];
    const errors = [];

    for (const p of products) {
      const product = p.node;

      if (product.status !== "ACTIVE") continue;

      const variant = product.variants.edges[0]?.node;

      const name = product.title;
      const urlProduct = `https://${shop}/products/${product.handle}`;
      const image = product.images.edges[0]?.node?.url || "";
      const category = product.productType || "";
      const brand = product.vendor || "";
      const price = variant?.price || "";
      const sku = variant?.sku || "";
      const ean = variant?.barcode || "";
      const quantity = product.totalInventory || 0;

      // 🔴 FISSO PER ORA (poi lo renderemo dinamico)
      const shipping_cost = "5.90";

      let missing = [];

      if (!category) missing.push("category");
      if (!ean) missing.push("EAN");
      if (!sku) missing.push("SKU");
      if (!price) missing.push("price");
      if (!shipping_cost) missing.push("shipping_cost");
      if (quantity <= 0) missing.push("quantity");

      if (missing.length > 0) {
        errors.push({
          name,
          sku,
          missing,
        });
        continue;
      }

      validProducts.push({
        name,
        url: urlProduct,
        image,
        category,
        brand,
        price,
        sku,
        ean,
        quantity,
        shipping_cost,
      });
    }

    // 👉 SALVO ERRORI GLOBALI (temporaneo in memoria)
    global.feedErrors = errors;

    // 🔥 GENERAZIONE XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<offers>\n`;

    for (const p of validProducts) {
      xml += `
  <offer>
    <name><![CDATA[${p.name}]]></name>
    <url>${p.url}</url>
    <image>${p.image}</image>
    <category><![CDATA[${p.category}]]></category>
    <brand><![CDATA[${p.brand}]]></brand>
    <price>${p.price}</price>
    <sku>${p.sku}</sku>
    <ean>${p.ean}</ean>
    <availability>${p.quantity}</availability>
    <shipping_cost>${p.shipping_cost}</shipping_cost>
  </offer>`;
    }

    xml += `\n</offers>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Errore generazione feed", { status: 500 });
  }
}
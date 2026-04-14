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
      },
    );

    const data = await response.json();

    if (data.errors) {
      console.error("Shopify GraphQL top-level errors:", data.errors);
      return new Response("Errore Shopify GraphQL", { status: 500 });
    }

    const products = data?.data?.products?.edges || [];
    const validProducts = [];
    const errors = [];

    for (const edge of products) {
      const product = edge.node;

      if (product.status !== "ACTIVE") {
        continue;
      }

      const variant = product.variants?.edges?.[0]?.node || null;

      const name = product.title || "";
      const productUrl = `https://${shop}/products/${product.handle}`;
      const image = product.images?.edges?.[0]?.node?.url || "";
      const category = product.productType || "";
      const brand = product.vendor || "";
      const price = variant?.price || "";
      const sku = variant?.sku || "";
      const ean = variant?.barcode || "";
      const quantity = Number(product.totalInventory || 0);

      // Per ora fisso; poi lo renderemo configurabile da dashboard
      const shippingCost = "5.90";

      const missing = [];

      if (!category) missing.push("categoria");
      if (!ean) missing.push("EAN");
      if (!shippingCost) missing.push("spese_spedizione");
      if (!sku) missing.push("SKU");
      if (quantity <= 0) missing.push("quantità");

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
        description: product.title || "",
        url: productUrl,
        image,
        category,
        brand,
        price,
        sku,
        ean,
        quantity,
        shippingCost,
      });
    }

    global.feedErrors = errors;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<offers>\n`;

    for (const p of validProducts) {
      xml += `
  <offer>
    <name><![CDATA[${p.name}]]></name>
    <description><![CDATA[${p.description}]]></description>
    <url><![CDATA[${p.url}]]></url>
    <image><![CDATA[${p.image}]]></image>
    <category><![CDATA[${p.category}]]></category>
    <brand><![CDATA[${p.brand}]]></brand>
    <price>${p.price}</price>
    <ean><![CDATA[${p.ean}]]></ean>
    <sku><![CDATA[${p.sku}]]></sku>
    <quantity>${p.quantity}</quantity>
    <shipping_cost>${p.shippingCost}</shipping_cost>
  </offer>`;
    }

    xml += `\n</offers>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Errore generazione feed:", error);
    return new Response("Errore generazione feed", { status: 500 });
  }
}
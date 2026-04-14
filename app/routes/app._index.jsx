import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

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

    const isIncluded =
      product?.status === "ACTIVE" && Boolean(image) && price > 0;

    let exclusionReason = "";
    if (product?.status !== "ACTIVE") {
      exclusionReason = "Prodotto non attivo";
    } else if (!image) {
      exclusionReason = "Immagine mancante";
    } else if (price <= 0) {
      exclusionReason = "Prezzo non valido";
    }

    return {
      id: product.id,
      title: product.title || "",
      handle: product.handle || "",
      status: product.status || "DRAFT",
      vendor: product.vendor || "",
      productType: product.productType || "",
      onlineStoreUrl: product.onlineStoreUrl || "",
      image,
      price,
      barcode,
      isIncluded,
      exclusionReason,
      availability: "in stock",
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

function buildDashboardData(products) {
  const includedProducts = products.filter((product) => product.isIncluded);
  const excludedProducts = products.filter((product) => !product.isIncluded);

  return {
    includedCount: includedProducts.length,
    excludedCount: excludedProducts.length,
    feedStatus:
      includedProducts.length > 0
        ? "Pronto per la generazione"
        : "Nessun prodotto idoneo",
    excludedPreview: excludedProducts.slice(0, 10).map((product) => ({
      title: product.title,
      reason: product.exclusionReason || "Escluso",
    })),
  };
}

function buildFeedUrl(shop) {
  const appUrl = (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");
  if (!appUrl || !shop) {
    return "Configura SHOPIFY_APP_URL per ottenere il link pubblico";
  }
  return `${appUrl}/feed/${shop}.xml`;
}

async function fetchShopProducts(admin) {
  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first: 250 },
  });

  const responseJson = await response.json();

  if (responseJson?.errors?.length) {
    throw new Error(
      responseJson.errors.map((error) => error.message).join(" | "),
    );
  }

  const rawProducts =
    responseJson?.data?.products?.edges?.map((edge) => edge.node) || [];

  return normalizeProducts(rawProducts);
}

function formatDateTime(value) {
  if (!value) return "Mai";
  return new Date(value).toLocaleString("it-IT");
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const savedFeed = await prisma.feedState.findUnique({
    where: { shop: session.shop },
  });

  try {
    const products = await fetchShopProducts(admin);
    const dashboard = buildDashboardData(products);

    return {
      appName: "FeedyPrice – Trovaprezzi Feed",
      planName: "Trial attivo",
      shop: session.shop,
      feedStatus: savedFeed?.feedStatus || dashboard.feedStatus,
      feedUrl: savedFeed?.feedUrl || buildFeedUrl(session.shop),
      lastUpdated: savedFeed?.lastGeneratedAt
        ? formatDateTime(savedFeed.lastGeneratedAt)
        : "Mai",
      includedProducts: savedFeed?.includedCount ?? dashboard.includedCount,
      excludedProducts: savedFeed?.excludedCount ?? dashboard.excludedCount,
      xmlPreview: savedFeed?.xmlContent || "",
      excludedPreview: dashboard.excludedPreview,
      successMessage: "",
      appError: "",
    };
  } catch (error) {
    return {
      appName: "FeedyPrice – Trovaprezzi Feed",
      planName: "Trial attivo",
      shop: session.shop,
      feedStatus: savedFeed?.feedStatus || "Errore caricamento catalogo",
      feedUrl: savedFeed?.feedUrl || buildFeedUrl(session.shop),
      lastUpdated: savedFeed?.lastGeneratedAt
        ? formatDateTime(savedFeed.lastGeneratedAt)
        : "Mai",
      includedProducts: savedFeed?.includedCount ?? 0,
      excludedProducts: savedFeed?.excludedCount ?? 0,
      xmlPreview: savedFeed?.xmlContent || "",
      excludedPreview: [],
      successMessage: "",
      appError:
        error instanceof Error
          ? error.message
          : "Errore sconosciuto durante il caricamento prodotti.",
    };
  }
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  try {
    const products = await fetchShopProducts(admin);
    const dashboard = buildDashboardData(products);
    const xmlContent = buildXml(products);
    const feedUrl = buildFeedUrl(session.shop);
    const now = new Date();

    let feedStatus = dashboard.feedStatus;
    let successMessage = "Azione non riconosciuta.";

    if (intent === "generate-feed") {
      feedStatus = "Generato correttamente";
      successMessage = "Feed XML generato con successo.";
    } else if (intent === "refresh-feed") {
      feedStatus = "Aggiornato correttamente";
      successMessage = "Feed XML aggiornato con successo.";
    }

    await prisma.feedState.upsert({
      where: { shop: session.shop },
      update: {
        feedStatus,
        feedUrl,
        includedCount: dashboard.includedCount,
        excludedCount: dashboard.excludedCount,
        xmlContent,
        lastGeneratedAt: now,
      },
      create: {
        shop: session.shop,
        feedStatus,
        feedUrl,
        includedCount: dashboard.includedCount,
        excludedCount: dashboard.excludedCount,
        xmlContent,
        lastGeneratedAt: now,
      },
    });

    return {
      success: intent === "generate-feed" || intent === "refresh-feed",
      successMessage,
      feedStatus,
      feedUrl,
      lastUpdated: formatDateTime(now),
      includedProducts: dashboard.includedCount,
      excludedProducts: dashboard.excludedCount,
      xmlPreview: xmlContent,
      excludedPreview: dashboard.excludedPreview,
      appError: "",
    };
  } catch (error) {
    return {
      success: false,
      successMessage: "",
      feedStatus: "Errore generazione feed",
      feedUrl: buildFeedUrl(session.shop),
      lastUpdated: "Mai",
      includedProducts: 0,
      excludedProducts: 0,
      xmlPreview: "",
      excludedPreview: [],
      appError:
        error instanceof Error
          ? error.message
          : "Errore sconosciuto durante la generazione del feed.",
    };
  }
};

export default function Index() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();

  const currentData = {
    appName: loaderData.appName,
    planName: loaderData.planName,
    shop: loaderData.shop,
    feedStatus: fetcher.data?.feedStatus ?? loaderData.feedStatus,
    feedUrl: fetcher.data?.feedUrl ?? loaderData.feedUrl,
    lastUpdated: fetcher.data?.lastUpdated ?? loaderData.lastUpdated,
    includedProducts:
      fetcher.data?.includedProducts ?? loaderData.includedProducts,
    excludedProducts:
      fetcher.data?.excludedProducts ?? loaderData.excludedProducts,
    xmlPreview: fetcher.data?.xmlPreview ?? loaderData.xmlPreview,
    excludedPreview: fetcher.data?.excludedPreview ?? loaderData.excludedPreview,
    successMessage:
      fetcher.data?.successMessage ?? loaderData.successMessage ?? "",
    appError: fetcher.data?.appError ?? loaderData.appError ?? "",
  };

  const isSubmitting = fetcher.state !== "idle";

  const generateFeed = () => {
    const formData = new FormData();
    formData.append("intent", "generate-feed");
    fetcher.submit(formData, { method: "POST" });
  };

  const refreshFeed = () => {
    const formData = new FormData();
    formData.append("intent", "refresh-feed");
    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <s-page heading={currentData.appName}>
      <s-section heading="Benvenuto">
        <s-paragraph>
          Genera e gestisci il feed XML per Trovaprezzi in modo semplice,
          stabile e professionale, direttamente dal tuo store Shopify.
        </s-paragraph>
      </s-section>

      {currentData.appError && (
        <s-section heading="Errore applicazione">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-paragraph>{currentData.appError}</s-paragraph>
          </s-box>
        </s-section>
      )}

      <s-section heading="Panoramica feed">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-button
              onClick={generateFeed}
              {...(isSubmitting ? { loading: true } : {})}
            >
              Genera feed
            </s-button>

            <s-button
              variant="secondary"
              onClick={refreshFeed}
              {...(isSubmitting ? { loading: true } : {})}
            >
              Aggiorna feed
            </s-button>
          </s-stack>

          {currentData.successMessage && (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-paragraph>{currentData.successMessage}</s-paragraph>
            </s-box>
          )}

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-heading>Stato feed</s-heading>
            <s-paragraph>{currentData.feedStatus}</s-paragraph>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-heading>URL feed XML</s-heading>
            <s-paragraph>{currentData.feedUrl}</s-paragraph>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-heading>Ultimo aggiornamento</s-heading>
            <s-paragraph>{currentData.lastUpdated}</s-paragraph>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Statistiche">
        <s-stack direction="inline" gap="base">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-heading>Prodotti inclusi</s-heading>
            <s-paragraph>{currentData.includedProducts}</s-paragraph>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-heading>Prodotti esclusi</s-heading>
            <s-paragraph>{currentData.excludedProducts}</s-paragraph>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-heading>Piano attivo</s-heading>
            <s-paragraph>{currentData.planName}</s-paragraph>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Prodotti esclusi dal feed">
        {currentData.excludedPreview?.length ? (
          <s-stack direction="block" gap="base">
            {currentData.excludedPreview.map((item, index) => (
              <s-box
                key={`${item.title}-${index}`}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-heading>{item.title}</s-heading>
                <s-paragraph>{item.reason}</s-paragraph>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-paragraph>Nessun prodotto escluso.</s-paragraph>
        )}
      </s-section>

      <s-section heading="Anteprima XML">
        {currentData.xmlPreview ? (
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "12px",
                lineHeight: "1.45",
              }}
            >
              <code>{currentData.xmlPreview}</code>
            </pre>
          </s-box>
        ) : (
          <s-paragraph>
            Genera o aggiorna il feed per visualizzare qui l&apos;anteprima XML
            reale.
          </s-paragraph>
        )}
      </s-section>

      <s-section heading="Prossimi passi">
        <s-unordered-list>
          <s-list-item>Deploy su Render con dominio definitivo</s-list-item>
          <s-list-item>Configura SHOPIFY_APP_URL con URL Render</s-list-item>
          <s-list-item>Aggiungere mapping categorie Trovaprezzi</s-list-item>
          <s-list-item>Aggiungere diagnostica avanzata</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Stato app">
        <s-paragraph>
          Store collegato: <s-text>{currentData.shop}</s-text>
        </s-paragraph>
        <s-paragraph>
          Il feed e il suo stato ora vengono salvati nel database.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
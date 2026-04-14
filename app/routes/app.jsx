import { Form, useLoaderData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import {
  buildFeedAnalysis,
  buildXmlFeed,
  getFeedState,
  loadCatalogData,
  saveFeedState,
} from "../lib/trovaprezzi-feed.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  const appUrl = process.env.SHOPIFY_APP_URL || "";
  const xmlUrl = `${appUrl}/feed/${session.shop}.xml`;

  let feedState = await getFeedState(session.shop);
  let excludedProducts = [];
  let includedCount = feedState?.includedCount ?? 0;
  let excludedCount = feedState?.excludedCount ?? 0;
  let dashboardError = "";
  let generatedAt = feedState?.lastGeneratedAt ?? null;

  try {
    const { shop, products } = await loadCatalogData(admin);
    const analysis = buildFeedAnalysis(products, shop?.primaryDomain?.url ?? "");

    excludedProducts = analysis.excludedProducts;
    includedCount = analysis.includedProducts.length;
    excludedCount = analysis.excludedProducts.length;
  } catch (error) {
    dashboardError =
      error instanceof Error
        ? error.message
        : "Errore sconosciuto durante il caricamento prodotti.";
  }

  return {
    shop: session.shop,
    xmlUrl,
    feedState,
    includedCount,
    excludedCount,
    excludedProducts,
    dashboardError,
    generatedAt,
    currentTime: new Date().toISOString(),
  };
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent !== "refresh-feed") {
    return null;
  }

  const appUrl = process.env.SHOPIFY_APP_URL || "";
  const xmlUrl = `${appUrl}/feed/${session.shop}.xml`;

  try {
    const { shop, products } = await loadCatalogData(admin);
    const analysis = buildFeedAnalysis(products, shop?.primaryDomain?.url ?? "");
    const xmlContent = buildXmlFeed(analysis.includedProducts);

    await saveFeedState({
      shop: session.shop,
      feedUrl: xmlUrl,
      xmlContent,
      includedCount: analysis.includedProducts.length,
      excludedCount: analysis.excludedProducts.length,
      feedStatus:
        analysis.excludedProducts.length > 0
          ? "Generato con esclusioni"
          : "Generato correttamente",
    });

    return {
      ok: true,
    };
  } catch (error) {
    const currentState = await getFeedState(session.shop);

    await saveFeedState({
      shop: session.shop,
      feedUrl: xmlUrl,
      xmlContent: currentState?.xmlContent || "",
      includedCount: currentState?.includedCount || 0,
      excludedCount: currentState?.excludedCount || 0,
      feedStatus: "Errore generazione feed",
    });

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Errore sconosciuto durante la generazione del feed.",
    };
  }
}

function formatDate(value) {
  if (!value) return "Mai";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Mai";
  return date.toLocaleString("it-IT");
}

export default function AppDashboard() {
  const data = useLoaderData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const statusText =
    data.feedState?.feedStatus ||
    (data.excludedCount > 0 ? "Generato con esclusioni" : "Pronto");

  const hasExcluded = data.excludedProducts.length > 0;

  return (
    <div style={styles.page}>
      <div style={styles.grid}>
        <div style={styles.mainColumn}>
          <section style={styles.heroCard}>
            <div style={styles.badge}>Feed XML • Trovaprezzi • Shopify</div>
            <h1 style={styles.heroTitle}>FeedyPrice – Trovaprezzi</h1>
            <p style={styles.heroText}>
              Gestione professionale del feed XML con validazione prodotti,
              esclusione automatica degli articoli non conformi e diagnostica
              pronta per Trovaprezzi.
            </p>
            <div style={styles.heroStatus}>
              {hasExcluded
                ? "Feed controllato con esclusioni"
                : "Feed controllato correttamente"}
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Azioni feed</h2>
            <p style={styles.sectionText}>
              Controlla rapidamente il feed XML pubblico, aggiorna la dashboard
              diagnostica e consulta i prodotti esclusi.
            </p>

            <div style={styles.actionsRow}>
              <a
                href={data.xmlUrl}
                target="_blank"
                rel="noreferrer"
                style={styles.primaryButton}
              >
                Apri Feed XML
              </a>

              <Form method="post">
                <input type="hidden" name="intent" value="refresh-feed" />
                <button type="submit" style={styles.secondaryButton}>
                  {isSubmitting ? "Aggiornamento..." : "Aggiorna dashboard"}
                </button>
              </Form>

              <a href="#prodotti-esclusi" style={styles.ghostButton}>
                Vedi prodotti esclusi
              </a>
            </div>

            <div style={styles.infoBox}>
              <div style={styles.infoLabel}>URL FEED XML</div>
              <div style={styles.infoValue}>{data.xmlUrl}</div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Stato feed</h2>
            <p style={styles.sectionText}>
              Esito complessivo del controllo automatico su prodotti e campi
              obbligatori richiesti dal feed.
            </p>

            {data.dashboardError ? (
              <div style={styles.errorBox}>{data.dashboardError}</div>
            ) : hasExcluded ? (
              <div style={styles.warningBox}>
                Sono stati rilevati prodotti esclusi per mancanza di uno o più
                campi obbligatori.
              </div>
            ) : (
              <div style={styles.successBox}>
                Non risultano prodotti esclusi per mancanza dei campi
                obbligatori.
              </div>
            )}
          </section>

          <section id="prodotti-esclusi" style={styles.card}>
            <h2 style={styles.sectionTitle}>Prodotti esclusi</h2>
            <p style={styles.sectionText}>
              Qui trovi tutti i prodotti che non entrano nel feed perché manca
              almeno uno dei campi obbligatori: categoria, EAN, spese di
              spedizione, SKU o quantità.
            </p>

            {!hasExcluded ? (
              <div style={styles.successSoftBox}>Nessun errore</div>
            ) : (
              <div style={styles.excludedList}>
                {data.excludedProducts.map((product, index) => (
                  <div key={`${product.id}-${index}`} style={styles.excludedCard}>
                    <div style={styles.excludedHeader}>
                      <div>
                        <div style={styles.productTitle}>{product.title}</div>
                        <div style={styles.productMeta}>
                          SKU: {product.sku || "—"} • EAN: {product.ean || "—"}
                        </div>
                      </div>
                      <div style={styles.excludedBadge}>Escluso</div>
                    </div>

                    <div style={styles.errorTagsWrap}>
                      {product.errors.map((error, i) => (
                        <span key={`${error}-${i}`} style={styles.errorTag}>
                          {error}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside style={styles.sideColumn}>
          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Panoramica</h3>
            <p style={styles.sideText}>
              Numeri rapidi e stato operativo del feed.
            </p>

            <div style={styles.statCardGreen}>
              <div style={styles.statLabel}>Prodotti esclusi</div>
              <div style={styles.statNumber}>{data.excludedCount}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Piano attivo</div>
              <div style={styles.planValue}>Trial attivo</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Ultimo controllo</div>
              <div style={styles.datetimeValue}>
                {formatDate(data.generatedAt || data.currentTime)}
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Stato corrente</div>
              <div style={styles.statusValue}>{statusText}</div>
            </div>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Requisiti obbligatori</h3>
            <p style={styles.sideText}>
              Un prodotto entra nel feed solo se possiede tutti questi campi.
            </p>

            <div style={styles.reqItem}>Categoria</div>
            <div style={styles.reqItem}>EAN</div>
            <div style={styles.reqItem}>Spese di spedizione</div>
            <div style={styles.reqItem}>SKU</div>
            <div style={styles.reqItem}>Quantità</div>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Note</h3>
            <p style={styles.noteText}>
              Il feed mantiene estensione <strong>.xml</strong>. I prodotti non
              conformi vengono esclusi automaticamente e segnalati in dashboard.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: "24px",
    background: "#f3f5f7",
    minHeight: "100vh",
  },
  grid: {
    maxWidth: "1240px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "1.8fr 0.95fr",
    gap: "24px",
  },
  mainColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  sideColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  heroCard: {
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
    color: "#ffffff",
    borderRadius: "28px",
    padding: "28px",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
  },
  badge: {
    display: "inline-block",
    marginBottom: "16px",
    padding: "8px 14px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    fontSize: "13px",
    fontWeight: 700,
  },
  heroTitle: {
    margin: "0 0 12px 0",
    fontSize: "34px",
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  heroText: {
    margin: 0,
    maxWidth: "820px",
    fontSize: "17px",
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.92)",
  },
  heroStatus: {
    marginTop: "22px",
    display: "inline-block",
    padding: "10px 18px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 800,
    fontSize: "14px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
    border: "1px solid #e5e7eb",
  },
  sideCard: {
    background: "#ffffff",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
    border: "1px solid #e5e7eb",
  },
  sectionTitle: {
    margin: "0 0 6px 0",
    fontSize: "20px",
    fontWeight: 800,
    color: "#0f172a",
  },
  sectionText: {
    margin: "0 0 18px 0",
    fontSize: "15px",
    lineHeight: 1.5,
    color: "#64748b",
  },
  sideTitle: {
    margin: "0 0 6px 0",
    fontSize: "18px",
    fontWeight: 800,
    color: "#0f172a",
  },
  sideText: {
    margin: "0 0 18px 0",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#64748b",
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "18px",
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px 18px",
    borderRadius: "16px",
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: "15px",
    border: "none",
    boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
  },
  secondaryButton: {
    padding: "14px 18px",
    borderRadius: "16px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
    fontSize: "15px",
    border: "1px solid #cbd5e1",
    cursor: "pointer",
  },
  ghostButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px 18px",
    borderRadius: "16px",
    background: "#eef2ff",
    color: "#312e81",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: "15px",
    border: "1px solid #c7d2fe",
  },
  infoBox: {
    border: "1px solid #dbe4ee",
    borderRadius: "18px",
    padding: "16px",
    background: "#f8fafc",
  },
  infoLabel: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#64748b",
    marginBottom: "8px",
    letterSpacing: "0.04em",
  },
  infoValue: {
    fontSize: "22px",
    fontWeight: 800,
    color: "#0f172a",
    wordBreak: "break-word",
  },
  successBox: {
    borderRadius: "18px",
    padding: "18px",
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#166534",
    fontWeight: 800,
    fontSize: "16px",
  },
  successSoftBox: {
    borderRadius: "18px",
    padding: "18px",
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#166534",
    fontWeight: 800,
    fontSize: "18px",
  },
  warningBox: {
    borderRadius: "18px",
    padding: "18px",
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    fontWeight: 800,
    fontSize: "16px",
  },
  errorBox: {
    borderRadius: "18px",
    padding: "18px",
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#991b1b",
    fontWeight: 800,
    fontSize: "16px",
  },
  excludedList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  excludedCard: {
    borderRadius: "18px",
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    padding: "16px",
  },
  excludedHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "12px",
  },
  productTitle: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: "4px",
  },
  productMeta: {
    fontSize: "14px",
    color: "#64748b",
  },
  excludedBadge: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 800,
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  errorTagsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  errorTag: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#fff7ed",
    color: "#9a3412",
    fontWeight: 700,
    fontSize: "13px",
    border: "1px solid #fdba74",
  },
  statCardGreen: {
    borderRadius: "20px",
    border: "1px solid #86efac",
    background: "#ecfdf5",
    padding: "16px",
    marginBottom: "12px",
  },
  statCard: {
    borderRadius: "20px",
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    padding: "16px",
    marginBottom: "12px",
  },
  statLabel: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#64748b",
    marginBottom: "8px",
  },
  statNumber: {
    fontSize: "52px",
    fontWeight: 900,
    color: "#065f46",
    lineHeight: 1,
  },
  planValue: {
    fontSize: "24px",
    fontWeight: 900,
    color: "#0f172a",
  },
  datetimeValue: {
    fontSize: "20px",
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.25,
  },
  statusValue: {
    fontSize: "18px",
    fontWeight: 900,
    color: "#0f172a",
  },
  reqItem: {
    borderRadius: "16px",
    border: "1px solid #dbe4ee",
    background: "#f8fafc",
    padding: "14px 16px",
    marginBottom: "10px",
    fontSize: "16px",
    fontWeight: 800,
    color: "#0f172a",
  },
  noteText: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.6,
    color: "#475569",
  },
};
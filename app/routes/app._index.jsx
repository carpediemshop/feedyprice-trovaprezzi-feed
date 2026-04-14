import { useEffect, useMemo, useState } from "react";

function Card({ title, children, style = {} }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      {title ? (
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 14,
            color: "#111827",
          }}
        >
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div
      style={{
        minWidth: 170,
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>
        {value}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Mai";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Mai";
  return d.toLocaleString("it-IT");
}

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const shop =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop") ||
        "trovaprezzi-test.myshopify.com"
      : "trovaprezzi-test.myshopify.com";

  const feedUrl = `/feed/${shop}.xml`;

  useEffect(() => {
    let active = true;

    async function loadErrors() {
      try {
        setLoading(true);
        const res = await fetch("/feed/errors");
        const data = await res.json();

        if (!active) return;

        setErrors(Array.isArray(data.errors) ? data.errors : []);
        setGeneratedAt(data.generatedAt || null);
        setErrorMessage("");
      } catch (err) {
        if (!active) return;
        setErrorMessage("Impossibile leggere i dati del feed.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadErrors();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const excluded = errors.length;
    return {
      excluded,
      included: excluded === 0 ? "N/D" : "N/D",
      plan: "Trial attivo",
      generatedAtLabel: formatDate(generatedAt),
    };
  }, [errors, generatedAt]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "28px 24px 40px",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 38,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: 8,
            }}
          >
            FeedyPrice – Trovaprezzi
          </div>
          <div style={{ fontSize: 16, color: "#6b7280" }}>
            Gestione feed XML Trovaprezzi, controllo errori e validazione
            prodotti.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 20 }}>
            <Card title="Azioni feed">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <a href={feedUrl} target="_blank" rel="noreferrer">
                  <button
                    style={{
                      border: "none",
                      background: "#111827",
                      color: "#ffffff",
                      padding: "12px 18px",
                      borderRadius: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Apri Feed XML
                  </button>
                </a>

                <button
                  onClick={() => window.location.reload()}
                  style={{
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#111827",
                    padding: "12px 18px",
                    borderRadius: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Aggiorna dashboard
                </button>
              </div>

              <div
                style={{
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 14,
                  color: "#374151",
                  wordBreak: "break-all",
                }}
              >
                <strong>URL feed XML:</strong>
                <div style={{ marginTop: 6 }}>{feedUrl}</div>
              </div>
            </Card>

            <Card title="Stato feed">
              {loading ? (
                <div style={{ color: "#6b7280" }}>Caricamento...</div>
              ) : errorMessage ? (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    borderRadius: 12,
                    padding: 14,
                    fontWeight: 600,
                  }}
                >
                  {errorMessage}
                </div>
              ) : errors.length === 0 ? (
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    color: "#065f46",
                    borderRadius: 12,
                    padding: 14,
                    fontWeight: 700,
                  }}
                >
                  Nessun errore rilevato. I prodotti attualmente controllati non
                  risultano esclusi per campi obbligatori.
                </div>
              ) : (
                <div
                  style={{
                    background: "#fff7ed",
                    border: "1px solid #fdba74",
                    color: "#9a3412",
                    borderRadius: 12,
                    padding: 14,
                    fontWeight: 700,
                  }}
                >
                  Sono presenti {errors.length} prodotti esclusi dal feed.
                </div>
              )}
            </Card>

            <Card title="Prodotti esclusi">
              {loading ? (
                <div style={{ color: "#6b7280" }}>Caricamento...</div>
              ) : errors.length === 0 ? (
                <div
                  style={{
                    color: "#166534",
                    fontWeight: 700,
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  Nessun errore
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 12,
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Prodotto
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 12,
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          SKU
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: 12,
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Campi mancanti
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {errors.map((item, index) => (
                        <tr key={`${item.name}-${index}`}>
                          <td
                            style={{
                              padding: 12,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            {item.name || "-"}
                          </td>
                          <td
                            style={{
                              padding: 12,
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            {item.sku || "-"}
                          </td>
                          <td
                            style={{
                              padding: 12,
                              borderBottom: "1px solid #f1f5f9",
                              color: "#b91c1c",
                              fontWeight: 600,
                            }}
                          >
                            {Array.isArray(item.missing)
                              ? item.missing.join(", ")
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            <Card title="Panoramica">
              <div style={{ display: "grid", gap: 12 }}>
                <StatBox label="Prodotti esclusi" value={stats.excluded} />
                <StatBox label="Piano attivo" value={stats.plan} />
                <StatBox
                  label="Ultimo controllo"
                  value={stats.generatedAtLabel}
                />
              </div>
            </Card>

            <Card title="Requisiti obbligatori">
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  color: "#374151",
                  lineHeight: 1.8,
                }}
              >
                <li>Categoria</li>
                <li>EAN</li>
                <li>Spese di spedizione</li>
                <li>SKU</li>
                <li>Quantità</li>
              </ul>
            </Card>

            <Card title="Note">
              <div style={{ color: "#6b7280", lineHeight: 1.7 }}>
                Il feed mantiene estensione <strong>.xml</strong>. I prodotti
                che non rispettano i campi obbligatori vengono esclusi e mostrati
                in questa dashboard.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
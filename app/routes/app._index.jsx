import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
  if (!value) return "Mai";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Mai";
  return d.toLocaleString("it-IT");
}

function PageShell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #eef2f7 100%)",
        padding: "28px 24px 40px",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function Card({ title, subtitle, children, style = {} }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.96)",
        border: "1px solid #e2e8f0",
        borderRadius: 22,
        padding: 22,
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        ...style,
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: 16 }}>
          {title ? (
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </div>
          ) : null}
          {subtitle ? (
            <div
              style={{
                fontSize: 14,
                color: "#64748b",
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}

function MetricCard({ label, value, tone = "default" }) {
  const tones = {
    default: {
      bg: "#f8fafc",
      border: "#e2e8f0",
      text: "#0f172a",
      sub: "#64748b",
    },
    success: {
      bg: "#ecfdf5",
      border: "#a7f3d0",
      text: "#065f46",
      sub: "#047857",
    },
    warning: {
      bg: "#fff7ed",
      border: "#fdba74",
      text: "#9a3412",
      sub: "#c2410c",
    },
    danger: {
      bg: "#fef2f2",
      border: "#fecaca",
      text: "#991b1b",
      sub: "#b91c1c",
    },
  };

  const palette = tones[tone] || tones.default;

  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 18,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: palette.sub,
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 34,
          lineHeight: 1,
          fontWeight: 900,
          color: palette.text,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ children, tone = "neutral" }) {
  const tones = {
    neutral: {
      bg: "#e2e8f0",
      color: "#334155",
      border: "#cbd5e1",
    },
    success: {
      bg: "#dcfce7",
      color: "#166534",
      border: "#86efac",
    },
    warning: {
      bg: "#ffedd5",
      color: "#9a3412",
      border: "#fdba74",
    },
    danger: {
      bg: "#fee2e2",
      color: "#991b1b",
      border: "#fca5a5",
    },
  };

  const palette = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      {children}
    </span>
  );
}

function ActionButton({
  href,
  onClick,
  children,
  variant = "primary",
  target,
  rel,
}) {
  const commonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 14,
    fontWeight: 800,
    fontSize: 15,
    textDecoration: "none",
    cursor: "pointer",
    transition: "all 0.18s ease",
  };

  const variants = {
    primary: {
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      color: "#ffffff",
      border: "1px solid #0f172a",
      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
    },
    secondary: {
      background: "#ffffff",
      color: "#0f172a",
      border: "1px solid #cbd5e1",
      boxShadow: "0 4px 14px rgba(15, 23, 42, 0.05)",
    },
  };

  const style = { ...commonStyle, ...(variants[variant] || variants.primary) };

  if (href) {
    return (
      <a href={href} target={target} rel={rel} style={style}>
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} style={style}>
      {children}
    </button>
  );
}

function InfoPanel({ label, value, mono = false }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#64748b",
          fontWeight: 700,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontWeight: 700,
          lineHeight: 1.6,
          fontFamily: mono
            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
            : 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [readError, setReadError] = useState("");

  const shop =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop") ||
        "trovaprezzi-test.myshopify.com"
      : "trovaprezzi-test.myshopify.com";

  const feedUrl = `/feed/${shop}.xml`;

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("/feed/errors", {
          credentials: "same-origin",
        });
        const data = await res.json();

        if (!active) return;

        setErrors(Array.isArray(data.errors) ? data.errors : []);
        setGeneratedAt(data.generatedAt || null);
        setReadError("");
      } catch (error) {
        if (!active) return;
        setReadError("Impossibile leggere i dati diagnostici del feed.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const status = useMemo(() => {
    if (loading) {
      return {
        label: "Caricamento in corso",
        tone: "neutral",
        description:
          "La dashboard sta recuperando lo stato del feed e gli eventuali errori.",
      };
    }

    if (readError) {
      return {
        label: "Errore lettura diagnostica",
        tone: "danger",
        description: readError,
      };
    }

    if (errors.length > 0) {
      return {
        label: "Prodotti esclusi rilevati",
        tone: "warning",
        description:
          "Alcuni prodotti non possiedono tutti i campi obbligatori richiesti da Trovaprezzi.",
      };
    }

    return {
      label: "Feed controllato correttamente",
      tone: "success",
      description:
        "Non risultano prodotti esclusi per mancanza dei campi obbligatori.",
    };
  }, [loading, readError, errors]);

  return (
    <PageShell>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.8fr 1fr",
          gap: 22,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 22 }}>
          <Card
            style={{
              padding: 30,
              background:
                "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.95) 100%)",
              color: "#ffffff",
              border: "1px solid rgba(148,163,184,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 20,
                alignItems: "start",
                flexWrap: "wrap",
              }}
            >
              <div style={{ maxWidth: 760 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Feed XML • Trovaprezzi • Shopify
                </div>

                <div
                  style={{
                    fontSize: 46,
                    lineHeight: 1.05,
                    fontWeight: 900,
                    letterSpacing: "-0.04em",
                    marginBottom: 12,
                  }}
                >
                  FeedyPrice – Trovaprezzi
                </div>

                <div
                  style={{
                    fontSize: 17,
                    lineHeight: 1.7,
                    color: "rgba(255,255,255,0.78)",
                    maxWidth: 760,
                  }}
                >
                  Gestione professionale del feed XML con validazione prodotti,
                  esclusione automatica degli articoli non conformi e
                  diagnostica pronta per Trovaprezzi.
                </div>
              </div>

              <div style={{ minWidth: 240 }}>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </div>
            </div>
          </Card>

          <Card
            title="Azioni feed"
            subtitle="Controlla rapidamente il feed XML pubblico e aggiorna la dashboard diagnostica."
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <ActionButton href={feedUrl} target="_blank" rel="noreferrer">
                Apri Feed XML
              </ActionButton>

              <ActionButton
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                Aggiorna dashboard
              </ActionButton>
            </div>

            <InfoPanel label="URL feed XML" value={feedUrl} mono />
          </Card>

          <Card
            title="Stato feed"
            subtitle="Esito complessivo del controllo automatico sui prodotti e sulla struttura minima richiesta."
          >
            <div
              style={{
                background:
                  status.tone === "success"
                    ? "#ecfdf5"
                    : status.tone === "warning"
                      ? "#fff7ed"
                      : status.tone === "danger"
                        ? "#fef2f2"
                        : "#f8fafc",
                border:
                  status.tone === "success"
                    ? "1px solid #a7f3d0"
                    : status.tone === "warning"
                      ? "1px solid #fdba74"
                      : status.tone === "danger"
                        ? "1px solid #fecaca"
                        : "1px solid #e2e8f0",
                color:
                  status.tone === "success"
                    ? "#065f46"
                    : status.tone === "warning"
                      ? "#9a3412"
                      : status.tone === "danger"
                        ? "#991b1b"
                        : "#334155",
                borderRadius: 16,
                padding: 18,
                fontWeight: 800,
                fontSize: 16,
                lineHeight: 1.7,
              }}
            >
              {status.description}
            </div>
          </Card>

          <Card
            title="Prodotti esclusi"
            subtitle="I prodotti senza tutti i campi obbligatori non vengono inseriti nel feed e compaiono qui."
          >
            {loading ? (
              <div style={{ color: "#64748b", fontWeight: 700 }}>
                Caricamento in corso...
              </div>
            ) : readError ? (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  borderRadius: 16,
                  padding: 16,
                  fontWeight: 700,
                }}
              >
                {readError}
              </div>
            ) : errors.length === 0 ? (
              <div
                style={{
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#166534",
                  borderRadius: 16,
                  padding: 16,
                  fontWeight: 800,
                }}
              >
                Nessun errore
              </div>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: 18,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 760,
                    background: "#ffffff",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 14,
                          fontSize: 13,
                          color: "#475569",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        Prodotto
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 14,
                          fontSize: 13,
                          color: "#475569",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        SKU
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: 14,
                          fontSize: 13,
                          color: "#475569",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        Campi mancanti
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map((item, index) => (
                      <tr key={`${item?.name || "item"}-${index}`}>
                        <td
                          style={{
                            padding: 14,
                            borderBottom: "1px solid #f1f5f9",
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {item?.name || "-"}
                        </td>
                        <td
                          style={{
                            padding: 14,
                            borderBottom: "1px solid #f1f5f9",
                            color: "#334155",
                            fontWeight: 600,
                          }}
                        >
                          {item?.sku || "-"}
                        </td>
                        <td
                          style={{
                            padding: 14,
                            borderBottom: "1px solid #f1f5f9",
                            color: "#b91c1c",
                            fontWeight: 700,
                          }}
                        >
                          {Array.isArray(item?.missing) && item.missing.length > 0
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

        <div style={{ display: "grid", gap: 22 }}>
          <Card
            title="Panoramica"
            subtitle="Numeri rapidi e stato operativo del feed."
          >
            <div style={{ display: "grid", gap: 14 }}>
              <MetricCard
                label="Prodotti esclusi"
                value={loading ? "..." : errors.length}
                tone={errors.length > 0 ? "warning" : "success"}
              />
              <MetricCard label="Piano attivo" value="Trial attivo" />
              <MetricCard
                label="Ultimo controllo"
                value={loading ? "..." : formatDate(generatedAt)}
              />
            </div>
          </Card>

          <Card
            title="Requisiti obbligatori"
            subtitle="Un prodotto entra nel feed solo se possiede tutti questi campi."
          >
            <div style={{ display: "grid", gap: 10 }}>
              {[
                "Categoria",
                "EAN",
                "Spese di spedizione",
                "SKU",
                "Quantità",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  <span style={{ color: "#0ea5e9", fontSize: 18 }}>•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Note operative"
            subtitle="Comportamento previsto della dashboard e del feed pubblico."
          >
            <div
              style={{
                display: "grid",
                gap: 12,
                color: "#475569",
                lineHeight: 1.75,
              }}
            >
              <InfoPanel
                label="Estensione feed"
                value="Il feed pubblico mantiene estensione .xml."
              />
              <InfoPanel
                label="Regola di esclusione"
                value="I prodotti con campi obbligatori mancanti vengono esclusi automaticamente dal feed e mostrati nella sezione errori."
              />
              <InfoPanel
                label="Store collegato"
                value={shop}
                mono
              />
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
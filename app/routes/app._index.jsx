import { useEffect, useState } from "react";

export default function Index() {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/feed/errors")
      .then((res) => res.json())
      .then((data) => {
        setErrors(data.errors || []);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>📊 FeedyPrice – Trovaprezzi</h1>

      {/* AZIONI */}
      <div style={{ marginBottom: 20 }}>
        <a href="/feed/trovaprezzi.xml?shop=e9d9c4-38.myshopify.com" target="_blank">
          <button>🔗 Apri Feed XML</button>
        </a>
      </div>

      {/* STATO */}
      <div style={{ marginBottom: 20 }}>
        <h2>⚠️ Prodotti esclusi</h2>

        {loading ? (
          <p>Caricamento...</p>
        ) : errors.length === 0 ? (
          <p style={{ color: "green" }}>✅ Nessun errore</p>
        ) : (
          <table border="1" cellPadding="10" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Prodotto</th>
                <th>SKU</th>
                <th>Errori</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e, i) => (
                <tr key={i}>
                  <td>{e.name}</td>
                  <td>{e.sku}</td>
                  <td style={{ color: "red" }}>
                    {e.missing.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
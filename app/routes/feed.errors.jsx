import { authenticate } from "../shopify.server";
import { getFeedDiagnosticsForShop } from "../lib/trovaprezzi-feed.server";

export async function loader({ request }) {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;

    if (!shop) {
      return Response.json(
        {
          errors: [
            {
              name: "Errore autenticazione",
              sku: "-",
              missing: ["Shop non disponibile"],
            },
          ],
          generatedAt: null,
          feedUrl: "",
          includedCount: 0,
          excludedCount: 0,
          status: "Errore autenticazione",
        },
        { status: 401 },
      );
    }

    const diagnostics = await getFeedDiagnosticsForShop(shop);

    return Response.json(diagnostics, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        errors: [
          {
            name: "Errore generale",
            sku: "-",
            missing: [error?.message || "Errore sconosciuto"],
          },
        ],
        generatedAt: null,
        feedUrl: "",
        includedCount: 0,
        excludedCount: 1,
        status: "Errore diagnostica",
      },
      { status: 500 },
    );
  }
}
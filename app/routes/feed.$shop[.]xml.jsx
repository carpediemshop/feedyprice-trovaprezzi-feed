import { generateFeedForShop } from "../lib/trovaprezzi-feed.server";

export async function loader({ params }) {
  try {
    const shop = params.shop;

    if (!shop) {
      return new Response("Missing shop", { status: 400 });
    }

    const result = await generateFeedForShop(shop);

    return new Response(result.xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    return new Response(
      `Errore generazione feed: ${error?.message || "Errore sconosciuto"}`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }
}
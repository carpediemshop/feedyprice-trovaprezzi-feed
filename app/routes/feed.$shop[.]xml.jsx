import { getFeedState } from "../trovaprezzi-feed.server";

export async function loader({ params }) {
  const shop = params.shop;

  if (!shop) {
    return new Response("Missing shop", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const feedState = await getFeedState(shop);

  if (!feedState?.xmlContent) {
    return new Response("Feed not generated yet", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(feedState.xmlContent, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
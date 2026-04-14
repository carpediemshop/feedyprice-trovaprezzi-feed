import prisma from "../db.server";

export const loader = async ({ params }) => {
  const shop = params.shop;

  if (!shop) {
    return new Response("Missing shop parameter", { status: 400 });
  }

  const savedFeed = await prisma.feedState.findUnique({
    where: { shop },
  });

  if (!savedFeed?.xmlContent) {
    return new Response("Feed not generated yet", { status: 404 });
  }

  return new Response(savedFeed.xmlContent, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
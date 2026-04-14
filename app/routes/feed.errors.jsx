import { authenticate } from "../shopify.server";
import { getFeedDiagnosticsForShop } from "../lib/trovaprezzi-feed.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const diagnostics = await getFeedDiagnosticsForShop(admin);

  return Response.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    excludedProducts: diagnostics.excludedProducts ?? [],
    includedProducts: diagnostics.includedProducts ?? [],
    excludedCount: diagnostics.excludedProducts?.length ?? 0,
    includedCount: diagnostics.includedProducts?.length ?? 0,
  });
}
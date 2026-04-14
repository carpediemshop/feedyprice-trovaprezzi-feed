export async function loader() {
  return Response.json({
    errors: global.feedErrors || [],
    generatedAt: new Date().toISOString(),
  });
}
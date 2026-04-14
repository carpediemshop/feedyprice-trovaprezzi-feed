export async function loader() {
  return new Response(JSON.stringify(global.feedErrors || []), {
    headers: { "Content-Type": "application/json" },
  });
}
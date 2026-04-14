export async function loader() {
  return new Response(
    JSON.stringify({
      errors: global.feedErrors || [],
      generatedAt: new Date().toISOString(),
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
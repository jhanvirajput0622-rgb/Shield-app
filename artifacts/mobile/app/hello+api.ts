/**
 * GET /hello
 *
 * The canonical Expo Router API-route example. Confirms the server bundle is
 * generating routes: `curl http://localhost:8081/hello` → `{ "hello": "world" }`.
 */
export function GET(): Response {
  return Response.json({ hello: "world" });
}

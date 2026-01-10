import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3002);

serve({
  fetch: createApp().fetch,
  port
});

console.log(`API listening on http://localhost:${port}`);
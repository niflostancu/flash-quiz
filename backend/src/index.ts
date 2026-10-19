/**
 * Hono-based backend server for FQuiz.
 */

import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

const app = new Hono();

// app.get("/", (c) => c.text("fquiz ok"));

const publicDir = fileURLToPath(new URL("../dist/public", import.meta.url));
app.get("*", serveStatic({ root: publicDir }));

serve({ fetch: app.fetch, port: 3000, hostname: "localhost" }, (info) => {
  console.log(`fquiz backend listening on http://${info.address}:${info.port})`);
});

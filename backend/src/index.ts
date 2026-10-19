/**
 * Hono-based backend server for FQuiz.
 */

import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { loadConfig } from "./config/loader";

const app = new Hono();
const config = await loadConfig();

// app.get("/", (c) => c.text("fquiz ok"));

const publicDir = fileURLToPath(new URL("../dist/public", import.meta.url));
app.get("*", serveStatic({ root: publicDir }));

serve({ fetch: app.fetch, port: config.port, hostname: config.hostname }, (info) => {
  console.log(`fquiz listening on http://${info.address}:${info.port}`);
});

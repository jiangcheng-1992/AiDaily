import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

import { startAutoIngest } from "./auto-ingest.mjs";

const require = createRequire(import.meta.url);

process.env.HOSTNAME = process.env.HOSTNAME_BIND || "0.0.0.0";
process.env.CRON_SECRET ||= randomUUID();

startAutoIngest();

require("../.next/standalone/server.js");

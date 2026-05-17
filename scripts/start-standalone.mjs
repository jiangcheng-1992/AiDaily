import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

process.env.HOSTNAME = process.env.HOSTNAME_BIND || "0.0.0.0";

require("../.next/standalone/server.js");

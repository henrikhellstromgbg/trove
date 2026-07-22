import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

// Local development against a Postgres behind a Neon wsproxy. Never set in
// production, where the driver talks to Neon directly.
if (process.env.DATABASE_WS_PROXY) {
  neonConfig.wsProxy = () => process.env.DATABASE_WS_PROXY!;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({ client: pool, schema });
export { schema };

import { readFileSync } from "node:fs";
import { createBroker } from "../src/broker";
import { LEGACY_PATH } from "../src/broker/soap";

// The same handlers the browser demo uses, exposed over real HTTP.
const port = Number(process.env.PORT ?? 8787);
const broker = await createBroker();
const wsdl = readFileSync(new URL("../public/legacy-eligibility.wsdl", import.meta.url), "utf8");

Bun.serve({
  port,
  hostname: "127.0.0.1",
  fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === LEGACY_PATH && url.searchParams.has("wsdl")) {
      return new Response(wsdl, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
    }
    return broker.fetch(req);
  },
});

const [portal, reporting] = broker.clients;
console.log(`Eligibility Integration Broker (demo) listening on http://localhost:${port}`);
console.log("Credentials were generated just now and exist only in this process:");
console.log(`export CLIENT_ID=${portal?.id}`);
console.log(`export CLIENT_SECRET=${portal?.secret}`);
console.log(`export OTHER_CLIENT_ID=${reporting?.id}`);
console.log(`export OTHER_CLIENT_SECRET=${reporting?.secret}`);

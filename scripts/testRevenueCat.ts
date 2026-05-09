import { createClient } from "@replit/revenuecat-sdk/client";
import { listProjects } from "@replit/revenuecat-sdk";

async function test() {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  console.log("Key present:", !!apiKey, "| starts with:", apiKey?.slice(0, 8));

  const client = createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const result = await listProjects({ client, query: { limit: 5 } });
  console.log("data:", JSON.stringify(result.data, null, 2));
  console.log("error:", JSON.stringify(result.error, null, 2));
}

test().catch(console.error);

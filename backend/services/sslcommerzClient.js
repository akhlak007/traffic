import { sslcommerzConfig } from "../utils/sslGateway.js";

function jsonFromResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createSslcommerzClient(environment = process.env) {
  const fetchImpl = environment.SSLCOMMERZ_FETCH || fetch;
  const config = sslcommerzConfig(environment);

  return {
    config,
    async initiateSession(fields) {
      const body = new URLSearchParams(fields);
      const response = await fetchImpl(config.initiateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      const text = await response.text();
      const payload = jsonFromResponse(text);
      if (!payload) {
        throw new Error("SSLCOMMERZ initiation did not return JSON");
      }
      return payload;
    },
    async validateTransaction(valId) {
      const params = new URLSearchParams({
        val_id: String(valId || ""),
        store_id: config.storeId,
        store_passwd: config.storePassword,
        format: "json",
        v: "1"
      });
      const response = await fetchImpl(`${config.validateUrl}?${params.toString()}`);
      const text = await response.text();
      const payload = jsonFromResponse(text);
      if (!payload) {
        throw new Error("SSLCOMMERZ validation did not return JSON");
      }
      return payload;
    }
  };
}

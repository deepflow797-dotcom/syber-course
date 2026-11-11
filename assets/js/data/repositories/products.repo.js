// @ts-check
import { createClient } from "../supabase-client.js";
export function createProductsRepo(config) {
  const client = createClient(config);
  return {
    async getByHandle(handle) {
      if (!client.base || !client.key || !handle) return null;
      const rows = await client.request(
        `/rest/v1/restore_products?handle=eq.${encodeURIComponent(handle)}&select=*,restore_product_variants(*)`
      );
      return Array.isArray(rows) ? rows[0] || null : null;
    },
    async list({ active = true, limit = 500 } = {}) {
      if (!client.base || !client.key) return [];
      const q = active ? "&active=eq.true" : "";
      return (
        client.request(
          `/rest/v1/restore_products?select=*,restore_product_variants(*)${q}&order=created_at.desc&limit=${limit}`
        ) || []
      );
    }
  };
}

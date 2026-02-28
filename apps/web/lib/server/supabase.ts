import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let cached: SupabaseClient | null = null;
let tlsConfigured = false;

function loadRootEnvFallback(): void {
  const missing = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!missing) return;

  const candidatePaths = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")];
  const rootEnvPath = candidatePaths.find((candidatePath) => existsSync(candidatePath));
  if (!rootEnvPath) return;

  const content = readFileSync(rootEnvPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function shouldAllowSelfSignedTls(): boolean {
  const raw = process.env.SUPABASE_ALLOW_SELF_SIGNED_TLS?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return process.env.NODE_ENV !== "production";
}

function configureTlsForSupabaseIfNeeded(url: string): void {
  if (tlsConfigured) return;
  if (!url.startsWith("https://")) return;
  if (!shouldAllowSelfSignedTls()) return;

  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.warn(
      "[odyssey] SUPABASE_ALLOW_SELF_SIGNED_TLS enabled: TLS certificate verification disabled for Node fetch."
    );
  }

  tlsConfigured = true;
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached;

  loadRootEnvFallback();

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("supabase_env_missing");
  }

  configureTlsForSupabaseIfNeeded(url);

  cached = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return cached;
}

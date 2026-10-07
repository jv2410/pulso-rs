import { createClient } from "@supabase/supabase-js";

// Cliente admin server-side (service key). Só usado em rotas /api (nunca vai pro
// browser). Preferência por env var; fallback embutido (padrão do projeto).
// IMPORTANTE: repo público. A service_role NÃO fica no código — só em env var
// (SUPABASE_SERVICE_KEY) configurada no Vercel. Sem fallback com segredo.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://efficia.shop/clipdb";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
export const admin = createClient(SUPABASE_URL, SERVICE_KEY);

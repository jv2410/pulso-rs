import { createClient } from "@supabase/supabase-js";

// Cliente admin server-side (service key). Só usado em rotas /api (nunca vai pro
// browser). Preferência por env var; fallback embutido (padrão do projeto).
const SUPABASE_URL = process.env.SUPABASE_URL || "https://kkuxgyjecjlfgahhoipv.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdXhneWplY2psZmdhaGhvaXB2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTE1MDU1OCwiZXhwIjoyMDU2NzI2NTU4fQ.L5Oim4rS-ERTNrS8svfKRrQwnEpwhDiECF4IQjYssqk";
export const admin = createClient(SUPABASE_URL, SERVICE_KEY);

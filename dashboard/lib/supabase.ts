import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  // Banco migrado p/ Postgres self-hosted (efficia.shop/clipdb) após o Supabase cloud travar no 402.
  "https://efficia.shop/clipdb",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkxMzgyMzExLCJleHAiOjIxMDY3NDIzMTF9.WkWW8T_GVz3lH-7uOmWAg1riEOQMyy53_otOcL_Hx7w"
);

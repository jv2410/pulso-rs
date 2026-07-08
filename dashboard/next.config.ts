import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kkuxgyjecjlfgahhoipv.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdXhneWplY2psZmdhaGhvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExNTA1NTgsImV4cCI6MjA1NjcyNjU1OH0.B1hRoL3rh10Ea2u0KbIgcgaE-EAucnBYGh7I7eP9WSE",
    // Selo de versão (discreto no footer) — o Vercel injeta VERCEL_GIT_COMMIT_SHA
    // no build; assim dá pra ver qual commit está de fato no ar.
    NEXT_PUBLIC_COMMIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;

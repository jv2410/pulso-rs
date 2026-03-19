import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://kkuxgyjecjlfgahhoipv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdXhneWplY2psZmdhaGhvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExNTA1NTgsImV4cCI6MjA1NjcyNjU1OH0.B1hRoL3rh10Ea2u0KbIgcgaE-EAucnBYGh7I7eP9WSE"
);

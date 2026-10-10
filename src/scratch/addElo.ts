import { sql } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export async function addElo(playerId: string, delta: number): Promise<void> {
  const { error } = await supabase
    .from("kl_players")
    .update({ elo: sql`elo + ${delta}` })
    .eq("id", playerId);

  if (error) throw error;
}
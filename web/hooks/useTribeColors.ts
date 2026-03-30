import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";

const DEFAULT_TRIBE_COLORS: Record<string, string> = {
  VATU: "#2E7D32",
  CILA: "#1565C0",
  KALO: "#F57F17",
  MERGED: "#8E8E93",
};

export function useTribeColors() {
  const session = useAuthStore((s) => s.session);

  const { data: rows } = useQuery({
    queryKey: ["tribe_colors"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tribe_colors")
        .select("tribe_name, color");
      if (error) throw error;
      return data as { tribe_name: string; color: string }[];
    },
    enabled: !!session,
    staleTime: 1000 * 60 * 10,
  });

  return useMemo(() => {
    const map: Record<string, string> = { ...DEFAULT_TRIBE_COLORS };
    if (rows) {
      for (const row of rows) map[row.tribe_name] = row.color;
    }
    return map;
  }, [rows]);
}

export function useTribeColorMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tribe, color }: { tribe: string; color: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("tribe_colors")
        .upsert({ tribe_name: tribe, color }, { onConflict: "tribe_name" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tribe_colors"] });
    },
  });
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import type { Castaway } from "@shared/types";

export function useCastaways() {
  const session = useAuthStore((s) => s.session);

  return useQuery({
    queryKey: ["castaways"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("castaways")
        .select("*")
        .order("current_tribe")
        .order("name");
      if (error) throw error;
      return data as Castaway[];
    },
    enabled: !!session,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCastawaysByTribe() {
  const { data: castaways, ...rest } = useCastaways();

  const byTribe = useMemo(() => {
    if (!castaways) return null;
    return castaways.reduce<Record<string, Castaway[]>>((acc, c) => {
      (acc[c.current_tribe] ||= []).push(c);
      return acc;
    }, {});
  }, [castaways]);

  return { byTribe, castaways, ...rest };
}

export function useCastawayMap() {
  const { data: castaways } = useCastaways();

  return useMemo(() => {
    const map = new Map<number, Castaway>();
    castaways?.forEach((c) => map.set(c.id, c));
    return map;
  }, [castaways]);
}

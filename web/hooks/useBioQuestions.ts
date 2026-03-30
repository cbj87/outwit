import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { BioQuestion } from "@shared/types";

export function useBioQuestions() {
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["bio-questions"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bio_questions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) return [];
      return data as BioQuestion[];
    },
    staleTime: 1000 * 60 * 60,
  });
  return { questions, isLoading };
}

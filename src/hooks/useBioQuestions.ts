import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { BioQuestion } from '@/types';

export function useBioQuestions() {
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['bio-questions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bio_questions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) return [];
      return data as BioQuestion[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour — questions rarely change
  });

  return { questions, isLoading };
}

import { useAuthStore } from '@/store/authStore';

export function useIsCommissioner(): boolean {
  return useAuthStore((state) => state.isCommissioner);
}

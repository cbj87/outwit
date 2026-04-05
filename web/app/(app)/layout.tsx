import { NavBar } from "@/components/NavBar";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MobileHeader } from "@/components/MobileHeader";
import { PullToRefresh } from "@/components/PullToRefresh";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PullToRefresh />
      {/* Desktop: sticky top nav. Mobile: slim brand header */}
      <NavBar />
      <MobileHeader />
      {/* pb-20 on mobile reserves space above the fixed bottom tab bar */}
      <main className="max-w-4xl mx-auto w-full px-4 py-4 pb-24 md:pb-6 md:py-6">{children}</main>
      <BottomTabBar />
    </>
  );
}

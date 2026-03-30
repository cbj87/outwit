"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/": "Leaderboard",
  "/my-picks": "My Picks",
  "/castaways": "Castaways",
  "/profile": "Profile",
  "/admin": "Admin",
  "/admin/episode": "Log Episode",
  "/admin/prophecy": "Prophecy",
  "/admin/tribes": "Tribes",
  "/players/gallery": "Player Bios",
  "/bio": "My Survivor Bio",
};

function getTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match for dynamic routes
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (prefix !== "/" && pathname.startsWith(prefix)) return title;
  }
  return "Outwit Open";
}

export function MobileHeader() {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return (
    <header
      className="sticky top-0 z-50 border-b flex items-center justify-between px-4 h-12 md:hidden"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <span
        className="text-xs font-black tracking-widest"
        style={{ color: "var(--color-primary)" }}
      >
        OUTWIT
      </span>
      <span
        className="text-sm font-bold"
        style={{ color: "var(--color-text)" }}
      >
        {title}
      </span>
      {/* Spacer to visually center the title */}
      <span className="w-12" />
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function NavBar() {
  const pathname = usePathname();
  const isCommissioner = useAuthStore((s) => s.isCommissioner);
  const reset = useAuthStore((s) => s.reset);
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    reset();
    router.push("/sign-in");
    router.refresh();
  }

  const links = [
    { href: "/", label: "Leaderboard" },
    { href: "/my-picks", label: "My Picks" },
    { href: "/castaways", label: "Castaways" },
    { href: "/profile", label: "Profile" },
    ...(isCommissioner ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Brand */}
        <span
          className="text-sm font-black tracking-widest"
          style={{ color: "var(--color-primary)" }}
        >
          OUTWIT
        </span>

        {/* Links */}
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  color: active
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
                  backgroundColor: active
                    ? "rgba(196,64,47,0.08)"
                    : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            onClick={handleSignOut}
            className="ml-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer"
            style={{ color: "var(--color-text-muted)" }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}

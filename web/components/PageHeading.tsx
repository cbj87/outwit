import { ReactNode } from "react";

interface PageHeadingProps {
  /** The main page title */
  title: string;
  /** Optional element shown right-aligned on the same line */
  right?: ReactNode;
  /** Optional subtitle shown beneath the title */
  subtitle?: string;
}

/**
 * Large bold page heading — matches the iOS app's prominent heading style.
 * Usage:
 *   <PageHeading title="Leaderboard" right={<GroupSwitcher />} />
 */
export function PageHeading({ title, right, subtitle }: PageHeadingProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1
          className="text-3xl font-black tracking-tight leading-tight"
          style={{ color: "var(--color-text)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="flex-shrink-0 ml-3">{right}</div>}
    </div>
  );
}

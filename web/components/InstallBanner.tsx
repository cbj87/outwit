"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "installBannerDismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const iosDevice = isIOS();
    setIos(iosDevice);

    if (iosDevice) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: capture the native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="flex items-start gap-3 mx-4 mt-2 px-4 py-3 rounded-xl shadow-sm"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="text-2xl leading-none mt-0.5 shrink-0">📲</div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-snug" style={{ color: "var(--color-text)" }}>
          Add Outwit Open to your Home Screen
        </p>
        {ios ? (
          <p
            className="text-xs mt-0.5 leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Tap <strong>Share</strong> ⬆ at the bottom of Safari, then{" "}
            <strong>"Add to Home Screen"</strong>
          </p>
        ) : (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            Opens instantly, works offline
          </p>
        )}
      </div>

      {!ios && (
        <button
          onClick={handleInstall}
          className="shrink-0 self-center px-3 py-1.5 rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Add App
        </button>
      )}

      <button
        onClick={dismiss}
        className="shrink-0 self-start p-1 -mr-1 text-base leading-none"
        style={{ color: "var(--color-text-muted)" }}
        aria-label="Dismiss install banner"
      >
        ✕
      </button>
    </div>
  );
}

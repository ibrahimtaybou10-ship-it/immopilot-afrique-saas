"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { BRAND } from "@/lib/brand";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "install-prompt-dismissed";

/**
 * Enregistre le service worker et propose d'installer l'application sur l'écran d'accueil.
 *   - Android / Chrome : bouton « Installer » (invite native du navigateur) ;
 *   - iPhone / Safari  : explication du geste « Partager > Sur l'écran d'accueil ».
 * N'affiche rien si l'application est déjà installée ou si l'invitation a été fermée.
 */
export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // stockage indisponible (navigation privée) : on propose simplement l'installation
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setInstallEvent(null);
    setShowIosHint(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sans stockage, l'invitation réapparaîtra à la prochaine visite
    }
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  if (!installEvent && !showIosHint) return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3.5 lg:hidden" role="region" aria-label="Installer l'application">
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white">
        <Smartphone className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">Installer {BRAND.name} sur ce téléphone</p>
        {installEvent ? (
          <>
            <p className="mt-0.5 text-xs text-slate-600">Accès direct depuis l'écran d'accueil, en plein écran.</p>
            <button type="button" className="btn btn-primary btn-sm mt-2.5" onClick={install}>
              Installer l'application
            </button>
          </>
        ) : (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            Dans Safari, touchez le bouton <strong>Partager</strong>, puis <strong>« Sur l'écran d'accueil »</strong>.
          </p>
        )}
      </div>
      <button type="button" className="btn btn-ghost btn-sm -mt-1 -mr-1" aria-label="Fermer" onClick={dismiss}>
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

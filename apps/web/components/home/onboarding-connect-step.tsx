"use client";

import { Wallet, X } from "lucide-react";
import { SiCoinbase, SiWalletconnect } from "react-icons/si";
import { useConnect } from "wagmi";
import { getI18n } from "../../lib/i18n";

function ConnectorIcon({ connectorId, connectorName }: { connectorId?: string; connectorName?: string }) {
  const id = (connectorId ?? "").toLowerCase();
  const name = (connectorName ?? "").toLowerCase();
  const iconClass = "h-7 w-7 shrink-0 text-primary";

  if (id.includes("metamask") || name.includes("metamask")) {
    return <Wallet className={iconClass} aria-hidden />;
  }
  if (id.includes("walletconnect") || name.includes("walletconnect")) {
    return <SiWalletconnect className={iconClass} aria-hidden />;
  }
  if (id.includes("coinbase") || name.includes("coinbase")) {
    return <SiCoinbase className={iconClass} aria-hidden />;
  }
  return <Wallet className={iconClass} aria-hidden />;
}

type Props = {
  fullScreen?: boolean;
  onClose?: () => void;
  hideCloseButton?: boolean;
};

function getConnectErrorMessage(error: unknown, fallback: string, cancelled: string): { message: string; tone: "soft" | "error" } | null {
  if (!error || typeof error !== "object" || !("message" in error)) return null;
  const message = String((error as { message: string }).message ?? "");
  const normalized = message.toLowerCase();
  if (!message) return null;
  if (normalized.includes("request reset") || normalized.includes("user rejected")) {
    return { message: cancelled, tone: "soft" };
  }
  return { message, tone: "error" };
}

export function OnboardingConnectStep({ fullScreen = true, onClose, hideCloseButton }: Props) {
  const t = getI18n().wizard;
  const { connectors, connect, error: connectError, isPending } = useConnect();
  const connectErrorUi =
    getConnectErrorMessage(connectError, t.onboardingConnectionFailed, t.onboardingConnectionCancelled) ??
    (connectError ? { message: t.onboardingConnectionFailed, tone: "error" as const } : null);

  const content = (
    <>
      <div className="space-y-3 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t.onboardingTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.onboardingBody}</p>
        <p className="text-muted-foreground">{t.onboardingHint}</p>
      </div>

      <div className="flex flex-col gap-3">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            type="button"
            onClick={() => connect({ connector })}
            disabled={isPending}
            className="flex cursor-pointer items-center justify-center gap-4 rounded-xl border border-border bg-background px-5 py-4 text-center font-medium transition-colors duration-200 hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ConnectorIcon connectorId={connector.id} connectorName={connector.name} />
            <span>{connector.name}</span>
          </button>
        ))}
      </div>

      {connectErrorUi ? (
        <p
          className={`text-center text-sm ${connectErrorUi.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
          role="alert"
        >
          {connectErrorUi.message}
        </p>
      ) : null}

      {isPending ? (
        <p className="text-center text-sm text-muted-foreground">{t.onboardingConnecting}</p>
      ) : null}
    </>
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col bg-background bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/contact-bg.webp)" }}
      >
        {!hideCloseButton && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex size-10 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t.close}
          >
            <X className="h-6 w-6" aria-hidden />
          </button>
        ) : null}

        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 sm:px-6">
          <div className="mb-8 flex flex-col items-center gap-4">
            <img
              src="/imagotipo-h.svg"
              alt="Shift DeSoc"
              className="h-[7.5rem] w-auto sm:h-36"
            />
          </div>

          <div className="w-full max-w-lg space-y-6">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="card max-w-xl space-y-6">
      {content}
    </section>
  );
}

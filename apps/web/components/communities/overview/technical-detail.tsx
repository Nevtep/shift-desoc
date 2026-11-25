import type { ReactNode } from "react";

export function TechnicalDetail({ children }: { children: ReactNode }) {
  return (
    <details data-testid="community-technical-detail" className="card group">
      <summary className="cursor-pointer text-lg font-semibold">Detalle técnico</summary>
      <p className="mt-2 text-sm text-muted-foreground">
        Módulos desplegados, parámetros on-chain y verificación de roles de esta comunidad.
      </p>
      <div className="mt-4 space-y-6">{children}</div>
    </details>
  );
}

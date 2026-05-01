"use client";

import { useEffect, useState } from "react";

import { getI18n } from "../../lib/i18n";
import { EngagementSubmitForm } from "./engagement-submit-form";

export function EngagementSubmitModal() {
  const t = getI18n().engagementsPage;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (!open) return undefined;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" className="btn-primary cursor-pointer" onClick={() => setOpen(true)}>
        {t.ctaCreate}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label={t.closeModal}
            onClick={() => setOpen(false)}
          />
          <div
            className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto"
            role="presentation"
            onClick={(e) => e.stopPropagation()}
          >
            <EngagementSubmitForm />
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Moves a global route onto its community-scoped equivalent once the owning community is known. */
export function CommunityScopeRedirect({ href }: { href: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (href) router.replace(href as never);
  }, [href, router]);

  return null;
}

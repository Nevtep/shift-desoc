"use client";

import { usePathname } from "next/navigation";

const DEFAULT_BACKGROUND = "/contact-bg.webp";

const BACKGROUND_BY_PREFIX: Array<{ prefix: string; image: string }> = [
  { prefix: "/governance", image: "/contact-bg.webp" },
  { prefix: "/communities", image: "/contact-bg.webp" },
  { prefix: "/engagements", image: "/contact-bg.webp" },
  { prefix: "/marketplace", image: "/contact-bg.webp" },
  { prefix: "/housing", image: "/contact-bg.webp" },
  { prefix: "/profile", image: "/contact-bg.webp" }
];

function resolveBackground(pathname: string): string {
  const match = BACKGROUND_BY_PREFIX.find((item) => pathname.startsWith(item.prefix));
  return match?.image ?? DEFAULT_BACKGROUND;
}

export function SiteBackground() {
  const pathname = usePathname() ?? "/";
  const image = resolveBackground(pathname);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-55" style={{ backgroundImage: `url(${image})` }} />
      <div className="absolute inset-0 bg-background/35" />
    </div>
  );
}

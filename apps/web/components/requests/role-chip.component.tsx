export function RoleChip({ label, tone }: { label: string; tone: "blue" | "purple" | "slate" }) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-100 text-blue-800"
      : tone === "purple"
        ? "bg-purple-100 text-purple-800"
        : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{label}</span>;
}

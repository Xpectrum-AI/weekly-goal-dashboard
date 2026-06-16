import { cn, initials } from "@/lib/utils";
import { colorFor } from "@/lib/normalize";

export function Avatar({
  name,
  color,
  size = "md",
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white",
        dims
      )}
      style={{ backgroundColor: color || colorFor(name) }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

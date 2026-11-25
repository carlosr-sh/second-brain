import { Kbd } from "@/components/ui/kbd";
import { isMac } from "@/lib/utils";
import { formatKeys } from "./engine";

/** Renders a shortcut like "g d" as <Kbd>G</Kbd> <Kbd>D</Kbd>. */
export function KeysHint({ keys, className }: { keys: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      {formatKeys(keys, isMac).map((step, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && <span className="px-0.5 text-[10px] text-muted-foreground">então</span>}
          {step.map((cap) => (
            <Kbd key={cap}>{cap}</Kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Side drawer (used for the sidebar on mobile). Built on the Dialog primitive. */
export const Sheet = SheetPrimitive.Root;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

export function SheetContent({ className, children, side = "left", ...props }: ComponentProps<typeof SheetPrimitive.Content> & { side?: "left" | "right" }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 z-50 flex h-full w-72 max-w-[85vw] flex-col bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:duration-200 data-[state=closed]:animate-out data-[state=closed]:duration-150",
          side === "left"
            ? "left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left"
            : "right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

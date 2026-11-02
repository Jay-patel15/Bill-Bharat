import { cn } from "@/lib/utils";

// Dense, ruled grid with a header that stays put while the body scrolls.
export function Table({ className, ...props }) {
  return (
    <div className="w-full max-h-[70vh] overflow-auto rounded-md border">
      <table className={cn("w-full caption-bottom text-[13px] border-collapse", className)} {...props} />
    </div>
  );
}
export function THead({ className, ...props }) {
  return <thead className={cn("sticky top-0 z-10 bg-muted [&_tr]:border-b", className)} {...props} />;
}
export function TBody({ className, ...props }) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
export function TR({ className, ...props }) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/30", className)} {...props} />;
}
export function TH({ className, ...props }) {
  return <th className={cn("h-8 px-2 text-left align-middle font-semibold text-foreground border-r last:border-r-0 whitespace-nowrap", className)} {...props} />;
}
export function TD({ className, ...props }) {
  return <td className={cn("px-2 py-1.5 align-middle border-r last:border-r-0", className)} {...props} />;
}

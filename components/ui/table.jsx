import { cn } from "@/lib/utils";

export function Table({ className, ...props }) {
  return (
    <div className="w-full overflow-auto rounded-md border">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export function THead({ className, ...props }) {
  return <thead className={cn("bg-muted/50 [&_tr]:border-b", className)} {...props} />;
}
export function TBody({ className, ...props }) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
export function TR({ className, ...props }) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/30", className)} {...props} />;
}
export function TH({ className, ...props }) {
  return <th className={cn("h-10 px-3 text-left align-middle font-medium text-muted-foreground", className)} {...props} />;
}
export function TD({ className, ...props }) {
  return <td className={cn("p-3 align-middle", className)} {...props} />;
}

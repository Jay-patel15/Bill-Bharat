import { cn } from "@/lib/utils";

const variants = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-input text-foreground",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700"
};

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant], className)}
      {...props}
    />
  );
}

export function StatusBadge({ status }) {
  const map = {
    Paid: "success",
    Unpaid: "danger",
    "Partially Paid": "warning",
    Pending: "warning"
  };
  return <Badge variant={map[status] || "secondary"}>{status || "—"}</Badge>;
}

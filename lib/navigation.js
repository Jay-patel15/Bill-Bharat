import {
  LayoutDashboard, Users, Package, FileText, ShoppingCart,
  BarChart3, Sparkles, Settings
} from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales / Invoices", icon: FileText },
  { href: "/purchase", label: "Purchases", icon: ShoppingCart },
  { href: "/purchase/ai-upload", label: "AI Purchase Reader", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/reports/audit", label: "Audit Log (Edit Log)", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

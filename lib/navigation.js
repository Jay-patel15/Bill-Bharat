import {
  LayoutDashboard, Building2, Users, Package, FileText, ShoppingCart,
  BarChart3, Sparkles, FolderKanban, Settings
} from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/projects", label: "Projects (BOQ)", icon: FolderKanban },
  { href: "/sales", label: "Sales / Invoices", icon: FileText },
  { href: "/purchase", label: "Purchases", icon: ShoppingCart },
  { href: "/purchase/ai-upload", label: "AI Purchase Reader", icon: Sparkles },
  { href: "/journals", label: "Manual Journals", icon: FileText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/reports/daybook", label: "Accounting Day Book", icon: FileText },
  { href: "/reports/audit", label: "Audit Log (Edit Log)", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

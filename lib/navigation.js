import {
  LayoutDashboard, Building2, Users, Package, FileText, ShoppingCart,
  BarChart3, Sparkles, FolderKanban, Settings
} from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales / Invoices", icon: FileText },
  { href: "/purchase", label: "Purchases", icon: ShoppingCart },
  { href: "/purchase/ai-upload", label: "AI Purchase Reader", icon: Sparkles },
  { href: "/sales/ai-upload", label: "AI Sales Generator", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/reports/daybook", label: "Accounting Day Book", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/projects", label: "Projects (BOQ)", icon: FolderKanban, comingSoon: true },
  { href: "/journals", label: "Manual Journals", icon: FileText, comingSoon: true },
  { href: "/reports/audit", label: "Audit Log (Edit Log)", icon: BarChart3, comingSoon: true }
];

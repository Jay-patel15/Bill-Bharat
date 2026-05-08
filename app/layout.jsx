import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "BillBharat — GST Invoice & Inventory",
  description: "Modern GST-compliant invoicing, inventory and finance for Indian businesses.",
  icons: { icon: "/favicon.ico" }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}

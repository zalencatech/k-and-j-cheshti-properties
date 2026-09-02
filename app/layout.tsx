import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "K&J Cheshti Properties",
  description: "Property & Financial Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cash Flow Projection",
  description: "Foundation scaffold for the cash flow projection platform."
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

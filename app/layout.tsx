import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cash Flow Projection",
  description: "Foundation scaffold for the cash flow projection platform."
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  if (isDevAuthBypassEnabled()) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}

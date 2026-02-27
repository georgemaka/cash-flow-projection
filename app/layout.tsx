import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AppErrorBoundary } from "@/components/error/AppErrorBoundary";
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
        <body>
          <AppErrorBoundary>{children}</AppErrorBoundary>
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <AppErrorBoundary>{children}</AppErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}

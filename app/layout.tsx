import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { NavBar } from "@/components/ui/NavBar";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cash Flow Projection — Sukut Properties",
  description: "Monthly cash flow projections and actuals for Sukut Properties."
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <ToastProvider>{children}</ToastProvider>
    </>
  );
}

export default function RootLayout({ children }: RootLayoutProps) {
  if (isDevAuthBypassEnabled()) {
    return (
      <html lang="en">
        <body>
          <AppShell>{children}</AppShell>
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <AppShell>{children}</AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}

"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/admin/line-items", label: "Admin" }
] as const;

export function NavBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="nav-bar">
      <div className="nav-inner">
        <Link href="/" className="nav-brand">
          <span className="nav-logo">CF</span>
          <span className="nav-brand-text">
            <span className="nav-brand-name">Cash Flow</span>
            <span className="nav-brand-sub">Sukut Properties</span>
          </span>
        </Link>

        <nav className={`nav-links${mobileOpen ? " nav-links-open" : ""}`}>
          {NAV_LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link${isActive ? " nav-link-active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          className="nav-hamburger"
          onClick={() => setMobileOpen((o) => !o)}
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          <span className="nav-hamburger-bar" />
          <span className="nav-hamburger-bar" />
          <span className="nav-hamburger-bar" />
        </button>
      </div>
    </header>
  );
}

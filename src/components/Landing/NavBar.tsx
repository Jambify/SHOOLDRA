/**
 * src/components/landing/Navbar.tsx
 * ───────────────────────────────────
 * Sticky nav with scroll-aware blur background, route/hash active-state highlighting,
 * and mobile menu.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import schooldraLogo from "../../assets/schooldraLogo.webp";
import ThemeToggle from "../ui/ThemeToggle";

const NAV_LINKS = ["Mock Exams", "Pricing", "FAQ"];

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Helper active-state checkers
  const isAboutActive = location.pathname === "/about";
  const isGuestActive = location.pathname === "/guest";

  const renderNavLink = (item: string, onClick?: () => void) => {
    const slug = item.toLowerCase().replace(" ", "-");
    const isActive = isHome && location.hash === `#${slug}`;

    const baseClasses = "text-sm transition-colors";
    const activeClasses = isActive
      ? "text-brand font-bold"
      : "text-textMuted hover:text-textMain font-medium";

    if (isHome) {
      return (
        <a
          key={item}
          href={`#${slug}`}
          onClick={onClick}
          className={`${baseClasses} ${activeClasses}`}
        >
          {item}
        </a>
      );
    }

    return (
      <Link
        key={item}
        to={`/#${slug}`}
        onClick={onClick}
        className={`${baseClasses} ${activeClasses}`}
      >
        {item}
      </Link>
    );
  };

  return (
    <nav
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        isScrolled
          ? "bg-bgSurface/95 border-borderMuted shadow-nav backdrop-blur-md"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div
          className="flex cursor-pointer items-center gap-2.5"
          onClick={() => navigate("/")}
        >
          <img src={schooldraLogo} alt="Schooldra" className="h-8 w-8" width={32} height={32} loading="eager" />
          <span className="font-display text-lg font-bold tracking-tight">
            Schooldra
          </span>
        </div>

        {/* Desktop Links */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            to="/about"
            className={`text-sm transition-colors ${
              isAboutActive
                ? "text-brand font-bold"
                : "text-textMuted hover:text-textMain font-medium"
            }`}
          >
            About
          </Link>
          {NAV_LINKS.map((item) => renderNavLink(item))}
        </div>

        {/* Desktop CTAs */}
        <div className="flex items-center gap-4">
          <Link
            to="/guest"
            className={`hidden text-sm transition-colors md:block ${
              isGuestActive
                ? "text-brand font-bold"
                : "text-textMuted hover:text-textMain font-bold"
            }`}
          >
            Practice Mode
          </Link>
          {/* Theme toggle — utility control, sits with CTAs (not among NAV_LINKS
              since it's not a nav destination), placed before "Start now" so the
              primary CTA stays the rightmost, highest-contrast element in the row. */}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <Link
            to="/signup"
            className="bg-brand hover:bg-brand-light rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all shadow-[0_14px_30px_rgba(124,60,255,0.18)]"
          >
            Start now
          </Link>
          <button
            className="md:hidden text-textMain"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-borderMuted bg-bgMain flex flex-col gap-4 border-t px-6 py-4 md:hidden"
        >
          <Link
            to="/about"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`text-sm ${
              isAboutActive ? "text-brand font-bold" : "text-textMain font-bold"
            }`}
          >
            About
          </Link>
          {NAV_LINKS.map((item) =>
            renderNavLink(item, () => setIsMobileMenuOpen(false)),
          )}
          <Link
            to="/guest"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`text-sm ${
              isGuestActive ? "text-brand font-bold" : "text-textMain font-bold"
            }`}
          >
            Practice Mode
          </Link>
          <Link
            to="/signin"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-textMuted text-sm font-bold"
          >
            Sign In
          </Link>
          {/* Theme toggle — last item, utility control not a nav destination */}
          <div className="border-borderMuted flex items-center justify-between border-t pt-4">
            <span className="text-textMuted text-sm font-bold">Theme</span>
            <ThemeToggle />
          </div>
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;
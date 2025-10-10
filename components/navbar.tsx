"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Sun, Moon } from "lucide-react";
import Image from "next/image";
import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/nextjs";

interface NavbarProps {
  onGetStarted: () => void;
  onLogin: () => void;
  onScrollToSection: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onGetStarted,
  onLogin,
  onScrollToSection,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const navItems = [
    // { name: "Get Started", href: "#get-started", action: "modal" },
    { name: "Docs", href: "/docs", action: "link" },
    { name: "Pricing", href: "/pricing", action: "scroll" },
  ];

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleNavClick = (item: (typeof navItems)[0]) => {
    if (item.action === "modal") {
      onGetStarted();
    } else if (item.action === "scroll") {
      const sectionId = item.href.replace("#", "");
      onScrollToSection(sectionId);
    } else if (item.action === "link") {
      router.push(item.href);
    }
    setIsOpen(false); // Close mobile menu
  };

  return (
    <nav className="border-b bg-white backdrop-blur-sm sticky top-0 z-50 dark:bg-background/80 dark:border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex-shrink-0 h-16 flex items-center">
          <Link href="/" className="flex items-center">
            <Image
              // src="/egyptfi_logo-03.png"
              src="/egyptfi.jpeg"
              alt="EGYPTFI"
              width={600}
              height={600}
              priority
              className="h-48 w-48 object-contain dark:hidden"
            />
            <Image
              src="/egyptfi_white-03.png"
              alt="EGYPTFI"
              width={600}
              height={600}
              priority
              className="h-48 w-48 object-contain rounded-full hidden dark:block"
            />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => handleNavClick(item)}
              className="text-gray-600 hover:text-gray-900 dark:text-foreground/80 dark:hover:text-foreground transition-colors text-sm font-medium"
            >
              {item.name}
            </button>
          ))}
        </nav>

        {/* Right side: Auth, Theme Toggle & Mobile Menu */}
        <div className="flex items-center space-x-3">
          <SignedOut>
            <Button
              onClick={onLogin}
              variant="outline"
              className="text-sm font-medium"
            >
              Sign In
            </Button>
            <Button onClick={onGetStarted} className="text-sm font-medium">
              Get Started
            </Button>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="flex items-center">
              <Button className="text-sm font-medium">Dashboard</Button>
            </Link>
            <UserButton />
          </SignedIn>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-gray-600 hover:text-gray-900 dark:text-foreground/80 dark:hover:text-foreground"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-600 hover:text-gray-900 dark:text-foreground/80 dark:hover:text-foreground"
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col space-y-4 mt-8">
                  {navItems.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => handleNavClick(item)}
                      className="text-gray-600 hover:text-gray-900 dark:text-foreground/80 dark:hover:text-foreground px-3 py-2 rounded-md text-lg font-medium transition-colors duration-200 text-left"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

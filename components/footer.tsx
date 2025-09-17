"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Twitter,
  Send,
  Github,
  Mail,
  MapPin,
  Phone,
  ExternalLink,
  Heart,
} from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export const Footer: React.FC = () => {
  const footerRef = useRef<HTMLElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const newsletterRef = useRef<HTMLDivElement>(null);
  const bottomSectionRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!footerRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: footerRef.current,
        start: "top 90%",
        end: "bottom 10%",
        toggleActions: "play none none reverse",
      },
    });

    // Animate main footer content with stagger
    tl.fromTo(
      mainContentRef.current?.children || [],
      {
        opacity: 0,
        y: 30,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power2.out",
      }
    );

    // Animate newsletter section
    tl.fromTo(
      newsletterRef.current,
      {
        opacity: 0,
        y: 20,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out",
      },
      "-=0.4"
    );

    // Animate bottom section
    tl.fromTo(
      bottomSectionRef.current,
      {
        opacity: 0,
        y: 20,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out",
      },
      "-=0.3"
    );

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  const footerLinks = {
    product: [
      { name: "Features", href: "#features" },
      { name: "Pricing", href: "/pricing" },
      { name: "API Docs", href: "/docs" },
      { name: "Sandbox", href: "/sandbox" },
      { name: "Status", href: "/status" },
    ],
    company: [
      { name: "About", href: "/about" },
      { name: "Blog", href: "/blog" },
      { name: "Careers", href: "/careers" },
      { name: "Press", href: "/press" },
      { name: "Contact", href: "/contact" },
    ],
    support: [
      { name: "Help Center", href: "/help" },
      { name: "Community", href: "/community" },
      { name: "Security", href: "/security" },
      { name: "Privacy", href: "/privacy" },
      { name: "Terms", href: "/terms" },
    ],
    resources: [
      { name: "Developer Portal", href: "/developers" },
      { name: "Integration Guide", href: "/integration" },
      { name: "Webhooks", href: "/webhooks" },
      { name: "SDKs", href: "/sdks" },
      { name: "Changelog", href: "/changelog" },
    ],
  };

  const socialLinks = [
    {
      name: "Twitter",
      icon: Twitter,
      href: "https://twitter.com/egyptfi_",
      color: "hover:text-blue-400",
    },
    {
      name: "GitHub",
      icon: Github,
      href: "https://github.com/egyptfi",
      color: "hover:text-gray-300",
    },
    {
      name: "Email",
      icon: Mail,
      href: "mailto:hello@egyptfi.com",
      color: "hover:text-red-400",
    },
    {
      name: "Telegram",
      icon: Send,
      href: "https://t.me/egyptfi",
      color: "hover:text-blue-500",
    },
  ];

  return (
    <footer ref={footerRef} className="bg-background border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div ref={mainContentRef} className="py-12">
          <div className="grid grid-cols-1 items-center md:grid-cols-2 lg:grid-cols-6 gap-8">
            {/* Brand Section */}
            <div className="lg:col-span-2">
              <Link href="/" className="flex items-center mb-4">
                <Image
                  src="/egyptfi_logo-03.png"
                  alt="EGYPTFI"
                  width={720}
                  height={240}
                  className="h-48 w-auto dark:hidden"
                />
                <Image
                  src="/egyptfi_white-03.png"
                  alt="EGYPTFI"
                  width={720}
                  height={240}
                  className="h-48 w-auto hidden dark:block"
                />
              </Link>
              <p className="text-muted-foreground mb-6 max-w-sm">
                The future of decentralized finance for merchants. Accept crypto
                payments seamlessly with our enterprise-grade blockchain
                infrastructure.
              </p>

              {/* Contact Info */}
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Kaduna, Nigeria</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>hello@egyptfi.com</span>
                </div>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Product</h3>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Company</h3>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Support</h3>
              <ul className="space-y-3">
                {footerLinks.support.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources Links */}
            <div>
              <h3 className="font-semibold text-foreground mb-4">Resources</h3>
              <ul className="space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom Section */}
        <div ref={bottomSectionRef} className="py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Copyright */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>© {currentYear} EgyptFi. Made with</span>
              <Heart className="h-4 w-4 text-red-500 fill-current" />
              <span>for merchants worldwide.</span>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <Link
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-muted-foreground transition-colors duration-200 ${social.color}`}
                >
                  <social.icon className="h-5 w-5" />
                  <span className="sr-only">{social.name}</span>
                </Link>
              ))}
            </div>

            {/* Legal Links */}
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                Terms
              </Link>
              <Link
                href="/cookies"
                className="text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

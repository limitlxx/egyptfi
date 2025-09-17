"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface HeroSectionProps {
  onGetStarted: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onGetStarted }) => {
  const heroRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const demoButtonRef = useRef<HTMLButtonElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const indicatorsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heroRef.current) return;

    const tl = gsap.timeline();

    // Animate title with text reveal effect
    tl.fromTo(
      titleRef.current,
      {
        opacity: 0,
        y: 50,
        rotationX: -90,
      },
      {
        opacity: 1,
        y: 0,
        rotationX: 0,
        duration: 1.2,
        ease: "back.out(1.7)",
      }
    );

    // Animate subtitle
    tl.fromTo(
      subtitleRef.current,
      {
        opacity: 0,
        y: 30,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power2.out",
      },
      "-=0.5"
    );

    // Animate demo button
    tl.fromTo(
      demoButtonRef.current,
      {
        opacity: 0,
        y: 20,
        scale: 0.8,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        ease: "back.out(1.7)",
      },
      "-=0.3"
    );

    // Animate buttons with stagger
    tl.fromTo(
      buttonsRef.current?.children || [],
      {
        opacity: 0,
        y: 20,
        scale: 0.8,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        stagger: 0.2,
        ease: "back.out(1.7)",
      },
      "-=0.3"
    );

    // Animate indicators
    tl.fromTo(
      indicatorsRef.current?.children || [],
      {
        opacity: 0,
        scale: 0,
      },
      {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        stagger: 0.1,
        ease: "back.out(1.7)",
      },
      "-=0.2"
    );

    // Add hover animations to buttons
    const buttons = buttonsRef.current?.querySelectorAll("button") || [];
    buttons.forEach((button) => {
      button.addEventListener("mouseenter", () => {
        gsap.to(button, {
          scale: 1.05,
          duration: 0.3,
          ease: "power2.out",
        });
      });

      button.addEventListener("mouseleave", () => {
        gsap.to(button, {
          scale: 1,
          duration: 0.3,
          ease: "power2.out",
        });
      });
    });

    return () => {
      tl.kill();
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8"
    >
      <div className="text-center max-w-4xl mx-auto">
        {/* Main Heading */}
        <h1
          ref={titleRef}
          className="text-4xl sm:text-5xl mt-12 md:text-6xl lg:text-7xl font-bold text-foreground mb-8 leading-tight"
        >
          The Future of{" "}
          <span className="bg-gradient-to-r from-primary to-yellow-600 bg-clip-text text-transparent">
            Decentralized Finance
          </span>{" "}
          for Merchants
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed"
        >
          Empower your business with invisible wallets, zk-KYC compliance, yield
          farming, and instant payments on the Starknet blockchain.
        </p>

        {/* CTA Buttons */}
        <div
          ref={buttonsRef}
          className="flex flex-col sm:flex-row gap-6 justify-center items-center"
        >
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
            onClick={onGetStarted}
          >
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="border-primary text-primary px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-300"
            asChild
          >
            <Link href="/docs">API Docs</Link>
          </Button>
        </div>

        {/* Enhanced visual indicators */}
        <div ref={indicatorsRef} className="mt-20 flex justify-center">
          <div className="flex items-center space-x-12">
            <div className="group flex items-center space-x-3 cursor-pointer">
              <div className="relative">
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-lg shadow-primary/50"></div>
                <div className="absolute inset-0 w-3 h-3 bg-primary rounded-full animate-ping opacity-30"></div>
              </div>
              <span className="text-foreground font-semibold text-base group-hover:text-primary duration-300 transform group-hover:scale-105 transition-transform">
                Secure
              </span>
            </div>

            <div className="group flex items-center space-x-3 cursor-pointer">
              <div className="relative">
                <div
                  className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-lg shadow-primary/50"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="absolute inset-0 w-3 h-3 bg-primary rounded-full animate-ping opacity-30"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
              <span className="text-foreground font-semibold text-base group-hover:text-primary duration-300 transform group-hover:scale-105 transition-transform">
                Fast
              </span>
            </div>

            <div className="group flex items-center space-x-3 cursor-pointer">
              <div className="relative">
                <div
                  className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-lg shadow-primary/50"
                  style={{ animationDelay: "0.4s" }}
                ></div>
                <div
                  className="absolute inset-0 w-3 h-3 bg-primary rounded-full animate-ping opacity-30"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
              <span className="text-foreground font-semibold text-base group-hover:text-primary transition-colors duration-300 transform group-hover:scale-105 transition-transform">
                Reliable
              </span>
            </div>
          </div>
        </div>
        {/* Run Demo Button */}
        <div className="mt-12 flex justify-center">
          <Button
            ref={demoButtonRef}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold rounded-lg shadow-lg transition-all duration-300"
            asChild
          >
            <Link href="/demo">
              <Play className="mr-2 h-5 w-5" />
              Run Demo
            </Link>
          </Button>
        </div>
      </div>

      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl"></div>
      </div>
    </section>
  );
};

export default HeroSection;

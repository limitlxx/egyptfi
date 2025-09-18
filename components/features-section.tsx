"use client";

import React, { useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, Wallet, TrendingUp, Zap, Eye, Lock } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export const FeaturesSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const featuresGridRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 80%",
        end: "bottom 20%",
        toggleActions: "play none none reverse",
      },
    });

    // Animate header
    tl.fromTo(
      headerRef.current,
      {
        opacity: 0,
        y: 50,
      },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power2.out",
      }
    );

    // Animate feature cards with stagger
    tl.fromTo(
      featuresGridRef.current?.children || [],
      {
        opacity: 0,
        y: 30,
        scale: 0.9,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.8,
        stagger: 0.1,
        ease: "back.out(1.7)",
      },
      "-=0.5"
    );

    // Animate benefits section
    tl.fromTo(
      benefitsRef.current?.children || [],
      {
        opacity: 0,
        y: 20,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.15,
        ease: "power2.out",
      },
      "-=0.3"
    );

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  const features = [
    {
      icon: <Eye className="h-8 w-8 text-primary" />,
      title: "Invisible Wallets",
      description:
        "Seamlessly integrated wallet solutions that work behind the scenes, providing users with a frictionless experience while maintaining full security and control.",
      gradient: "from-blue-500 to-purple-600",
    },
    {
      icon: <Shield className="h-8 w-8 text-primary" />,
      title: "zk-KYC Compliance",
      description:
        "Zero-knowledge proof technology ensures compliance with KYC requirements while preserving user privacy and maintaining complete data confidentiality.",
      gradient: "from-green-500 to-teal-600",
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-primary" />,
      title: "Yield Farming",
      description:
        "Maximize returns through intelligent yield farming strategies, automatically optimizing liquidity provision across multiple protocols.",
      gradient: "from-orange-500 to-red-600",
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: "Instant Payments",
      description:
        "Lightning-fast transaction processing with near-instant confirmations, enabling real-time payments and settlements for your business.",
      gradient: "from-yellow-500 to-orange-600",
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="features"
      className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30"
    >
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <div ref={headerRef} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6">
            Powerful Features for{" "}
            <span className="bg-gradient-to-r from-primary to-yellow-600 bg-clip-text text-transparent">
              Modern Merchants
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            Experience the next generation of payment processing with
            cutting-edge blockchain technology designed specifically for
            business needs.
          </p>
        </div>

        {/* Features Grid */}
        <div
          ref={featuresGridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border-border/50 hover:border-primary/50 bg-card/50 backdrop-blur-sm"
            >
              <CardHeader className="text-center pb-4">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4 mx-auto group-hover:scale-110 transition-transform duration-300"
                >
                  {feature.icon}
                </div>
                <CardTitle className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground leading-relaxed text-center">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Benefits */}
        <div
          ref={benefitsRef}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Enterprise Security
            </h3>
            <p className="text-muted-foreground">
              Bank-grade security with multi-layer encryption and compliance
              standards.
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Multi-Chain Support
            </h3>
            <p className="text-muted-foreground">
              Seamlessly operate across multiple blockchain networks with
              unified APIs.
            </p>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Real-Time Analytics
            </h3>
            <p className="text-muted-foreground">
              Comprehensive dashboards with real-time transaction monitoring and
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

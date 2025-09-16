"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { FeaturesSection } from "@/components/features-section";
import { PreFooter } from "@/components/pre-footer";
import { Footer } from "@/components/footer";
import { SignupModal } from "@/components/signup-modal";
import PrismBackground from "@/components/prism-background";

export default function HomePage() {
  const [showSignupModal, setShowSignupModal] = useState(false);

  const handleGetStarted = () => {
    setShowSignupModal(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background Animation */}
      <div
        style={{
          width: "100%",
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
        }}
      >
        <PrismBackground
          animationType="3drotate"
          timeScale={0.5}
          height={3.5}
          baseWidth={5.5}
          scale={3.6}
          hueShift={0}
          colorFrequency={1}
          noise={0.2}
          glow={0.5}
        />
      </div>

      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <HeroSection onGetStarted={handleGetStarted} />

      {/* Features Section */}
      <FeaturesSection />

      {/* Pre-Footer Section */}
      <PreFooter />

      {/* Footer */}
      <Footer />

      {/* Signup Modal */}
      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
      />
    </div>
  );
}

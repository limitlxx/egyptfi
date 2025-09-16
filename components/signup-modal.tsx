"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mail,
  Lock,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SignupStep = "email" | "password" | "confirm";

interface SignupData {
  email: string;
  password: string;
  confirmPassword: string;
}

export const SignupModal: React.FC<SignupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState<SignupStep>("email");
  const [signupData, setSignupData] = useState<SignupData>({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const steps = [
    { key: "email", title: "Email", icon: Mail },
    { key: "password", title: "Password", icon: Lock },
    { key: "confirm", title: "Confirm", icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex((step) => step.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const handleInputChange = (field: keyof SignupData, value: string) => {
    setSignupData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleNext = () => {
    if (currentStep === "email") {
      if (!validateEmail(signupData.email)) {
        setError("Please enter a valid email address");
        return;
      }
      setCurrentStep("password");
    } else if (currentStep === "password") {
      if (!validatePassword(signupData.password)) {
        setError("Password must be at least 8 characters long");
        return;
      }
      setCurrentStep("confirm");
    }
  };

  const handleBack = () => {
    if (currentStep === "password") {
      setCurrentStep("email");
    } else if (currentStep === "confirm") {
      setCurrentStep("password");
    }
  };

  const handleSignup = async () => {
    if (signupData.password !== signupData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: signupData.email,
          password: signupData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      // Success - redirect to dashboard
      onClose();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "email":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Enter your email
              </h3>
              <p className="text-muted-foreground">
                We'll use this to create your account
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={signupData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="text-lg"
              />
            </div>
          </div>
        );

      case "password":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Create a password
              </h3>
              <p className="text-muted-foreground">
                Choose a strong password for your account
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={signupData.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  className="text-lg pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Password must be at least 8 characters long
              </p>
            </div>
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Confirm your password
              </h3>
              <p className="text-muted-foreground">
                Re-enter your password to confirm
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={signupData.confirmPassword}
                  onChange={(e) =>
                    handleInputChange("confirmPassword", e.target.value)
                  }
                  className="text-lg pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Create Your Account</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    index <= currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <step.icon className="h-4 w-4" />
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${
                      index < currentStepIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="py-4">{renderStepContent()}</div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={currentStep === "email" ? onClose : handleBack}
            disabled={isLoading}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === "email" ? "Cancel" : "Back"}
          </Button>

          <Button
            onClick={currentStep === "confirm" ? handleSignup : handleNext}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              "Creating Account..."
            ) : currentStep === "confirm" ? (
              "Create Account"
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignupModal;

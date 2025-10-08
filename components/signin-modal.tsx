"use client";

import React, { useState, useRef } from "react";
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
  ArrowRight,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { AuthManager } from "@/lib/auth-utils";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignup: () => void;
}

type LoginStep = "email" | "pin" | "authenticating";

interface LoginData {
  email: string;
  pin: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState<LoginStep>("email");
  const [loginData, setLoginData] = useState<LoginData>({
    email: "",
    pin: "",
  });
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const router = useRouter();
  const { signIn, isLoaded, setActive } = useSignIn();
  const { getToken } = useAuth();

  const steps = [
    { key: "email", title: "Email", icon: Mail },
    { key: "pin", title: "PIN", icon: Lock },
    { key: "authenticating", title: "Verify", icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex((step) => step.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePin = (pin: string) => {
    console.log(pin);
    
    return /^\d{6}$/.test(pin);
  };

  const renderPinInputs = (
    value: string,
    onChange: (value: string) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    const digits = value.split("");

    return (
      <div className="flex justify-center space-x-2">
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digits[index] || ""}
            onChange={(e) => {
              const newDigit = e.target.value.replace(/\D/g, "");
              const newDigits = [...digits];
              newDigits[index] = newDigit;
              const newValue = newDigits.join("").slice(0, 6);
              onChange(newValue);

              // Auto-focus next input
              if (newDigit && index < 5) {
                refs.current[index + 1]?.focus();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[index] && index > 0) {
                refs.current[index - 1]?.focus();
              }
            }}
            className="w-12 h-12 text-center text-lg font-semibold border-2 border-muted rounded-lg focus:border-primary focus:outline-none transition-colors"
          />
        ))}
      </div>
    );
  };

  const handleInputChange = (field: keyof LoginData, value: string) => {
    setLoginData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleNext = async () => {
    if (currentStep === "email") {
      if (!validateEmail(loginData.email)) {
        setError("Please enter a valid email address");
        return;
      }
      setCurrentStep("pin");
      // Auto-focus first PIN input after transition
      setTimeout(() => pinRefs.current[0]?.focus(), 100);
    }
  };

  const handleBack = () => {
    if (currentStep === "pin") {
      setCurrentStep("email");
    }
  };

  const handleLogin = async () => {
    if (!validatePin(loginData.pin)) {
      setError("PIN must be exactly 6 digits");
      return;
    }

    if (!isLoaded || !signIn) {
      setError("Authentication not ready. Please try again.");
      return;
    }

    setIsLoading(true);
    setError("");
    setCurrentStep("authenticating");

    try {
      // Create password from PIN (same format as signup)
      const strongPassword = `${loginData.pin}EgyptFi2024!`;

      console.log("Attempting Clerk login with email:", loginData.email);

      // Attempt to sign in with Clerk
      const result = await signIn.create({
        identifier: loginData.email,
        password: strongPassword,
      });

      console.log("Clerk login result:", result);

      if (result.status === "complete") {
        // Set the active session
        await setActive({ session: result.createdSessionId });

        // Get authentication token
        const token = await getToken();
        const clerkUserId = result.id;

        console.log("Login successful! Clerk user:", clerkUserId);

        if (!clerkUserId || !token) {
          throw new Error("Failed to create authenticated session");
        }

        // Call your backend to get merchant data
        const response = await fetch("/api/merchants/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            clerk_user_id: clerkUserId,
            email: loginData.email,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Authentication failed");
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Authentication failed");
        }

        // Store authentication data
        AuthManager.setMerchantInfo({
          id: data.merchant.id,
          businessName: data.merchant.business_name,
          businessEmail: data.merchant.business_email,
          walletAddress: data.merchant.wallet_address,
          createdAt: data.merchant.created_at,
          webhookUrl: data.merchant.webhook,
          phone: data.merchant.phone,
          defaultCurrency: data.merchant.local_currency,
          businessLogo: data.merchant.business_logo,
        });

        // Store API keys for both environments
        if (data.merchant.apikeys) {
          if (data.merchant.apikeys.testnet) {
            AuthManager.setApiKeys("testnet", {
              publicKey: data.merchant.apikeys.testnet.public_key,
            });
          }

          if (data.merchant.apikeys.mainnet) {
            AuthManager.setApiKeys("mainnet", {
              publicKey: data.merchant.apikeys.mainnet.public_key,
            });
          }
        }

        AuthManager.setCurrentEnvironment("testnet");

        // Success - redirect to dashboard
        setTimeout(() => {
          onClose();
          router.push("/dashboard");
        }, 1000);
      } else {
        throw new Error(`Unexpected login status: ${result.status}`);
      }
    } catch (err: any) {
      console.error("Login error:", err);
      
      let errorMessage = "Invalid email or PIN. Please try again.";
      
      if (err.errors && err.errors.length > 0) {
        const clerkError = err.errors[0];
        if (clerkError.code === "form_password_incorrect") {
          errorMessage = "Incorrect PIN. Please try again.";
        } else if (clerkError.code === "form_identifier_not_found") {
          errorMessage = "No account found with this email.";
        } else {
          errorMessage = clerkError.message || errorMessage;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setCurrentStep("pin"); // Go back to PIN step on error
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "email":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Welcome back
              </h3>
              <p className="text-muted-foreground">
                Enter your email to continue
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={loginData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && loginData.email) {
                    handleNext();
                  }
                }}
                className="text-lg h-12"
                autoFocus
              />
            </div>
          </div>
        );

      case "pin":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Enter your PIN
              </h3>
              <p className="text-muted-foreground text-sm">
                {loginData.email}
              </p>
            </div>
            <div className="space-y-4">
              {renderPinInputs(
                loginData.pin,
                (value) => {
                  handleInputChange("pin", value);
                  // Auto-submit when all 6 digits are entered
                  if (value.length === 6) {
                    setTimeout(() => handleLogin(), 300);
                  }
                },
                pinRefs
              )}
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => {
                    // TODO: Implement forgot PIN flow
                    setError("Forgot PIN? Please contact support.");
                  }}
                >
                  Forgot your PIN?
                </button>
              </div>
            </div>
          </div>
        );

      case "authenticating":
        return (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <CheckCircle className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Signing you in
              </h3>
              <p className="text-muted-foreground">
                Please wait while we authenticate your account...
              </p>
            </div>
            <div className="flex justify-center">
              <div role="status">
                <svg
                  aria-hidden="true"
                  className="w-10 h-10 text-gray-200 animate-spin fill-primary"
                  viewBox="0 0 100 101"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                    fill="currentColor"
                  />
                  <path
                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                    fill="currentFill"
                  />
                </svg>
                <span className="sr-only">Loading...</span>
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
          <DialogTitle className="text-center text-2xl">Sign In</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
                    index <= currentStepIndex
                      ? "bg-primary text-primary-foreground scale-110"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <step.icon className="h-4 w-4" />
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mx-2 transition-all duration-300 ${
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
        <div className="py-6">{renderStepContent()}</div>

        {/* Error Message */}
        {error && currentStep !== "authenticating" && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        {currentStep !== "authenticating" && (
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={currentStep === "email" ? onClose : handleBack}
              disabled={isLoading}
              className="h-11"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {currentStep === "email" ? "Cancel" : "Back"}
            </Button>

            <Button
              onClick={currentStep === "pin" ? handleLogin : handleNext}
              disabled={
                isLoading ||
                (currentStep === "email" && !loginData.email) ||
                (currentStep === "pin" && loginData.pin.length !== 6)
              }
              className="bg-primary hover:bg-primary/90 h-11 min-w-[120px]"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing In...
                </div>
              ) : currentStep === "pin" ? (
                "Sign In"
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Sign up link */}
        {currentStep === "email" && (
          <div className="text-center text-sm text-muted-foreground pt-4 border-t">
            Don't have an account?{" "}
            <button
              onClick={() => {
                onClose();
                // You can trigger your signup modal here
              }}
              className="text-primary hover:underline font-medium"
            >
              Sign up
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createWalletWithMerchantUpdate,
  createInvisibleWallet,
  getStoredEncryptionKey,
  generateSecureEncryptKey,
  clearStoredEncryptionKey,
  validateEncryptKey,
  type DbResult,
  type WalletCreationResult,
} from "@/lib/wallet-auth-integration";

import { useUser, useAuth, useSignUp } from "@clerk/nextjs";
import { useCreateWallet } from "@chipi-stack/chipi-react";

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SignupStep = "email" | "pin" | "confirm" | "email-verification" | "wallet";

interface SignupData {
  email: string;
  pin: string;
  confirmPin: string;
}

export const SignupModal: React.FC<SignupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState<SignupStep>("email");
  const [signupData, setSignupData] = useState<SignupData>({
    email: "",
    pin: "",
    confirmPin: "",
  });
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [response, setResponse] = useState({});
  const [merchantData, setMerchantData] = useState<DbResult | null>(null);
  const [error, setError] = useState<string | null>("");
  const [signupAttempt, setSignupAttempt] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const router = useRouter();
  const { createWalletAsync } = useCreateWallet();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signUp, isLoaded, setActive } = useSignUp();

  const steps = [
    { key: "email", title: "Email", icon: Mail },
    { key: "pin", title: "PIN", icon: Lock },
    { key: "confirm", title: "Confirm", icon: CheckCircle },
    { key: "email-verification", title: "Verify", icon: Mail },
    { key: "wallet", title: "Wallet", icon: Wallet },
  ];

  const currentStepIndex = steps.findIndex((step) => step.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePin = (pin: string) => {
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
            className="w-12 h-12 text-center text-lg font-semibold border-2 border-muted rounded-lg focus:border-primary focus:outline-none"
          />
        ))}
      </div>
    );
  };

  const handleInputChange = (field: keyof SignupData, value: string) => {
    setSignupData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleNext = async () => {
    if (currentStep === "email") {
      if (!validateEmail(signupData.email)) {
        setError("Please enter a valid email address");
        return;
      }

      // For now, just proceed to PIN step
      // Email validation will happen during actual signup
      setCurrentStep("pin");
    } else if (currentStep === "pin") {
      if (!validatePin(signupData.pin)) {
        setError("PIN must be exactly 6 digits");
        return;
      }
      setCurrentStep("confirm");
    }
  };

  const handleBack = () => {
    if (currentStep === "pin") {
      setCurrentStep("email");
    } else if (currentStep === "confirm") {
      setCurrentStep("pin");
    } else if (currentStep === "email-verification") {
      setCurrentStep("confirm");
    }
  };

  const handleSignup = async () => {
    if (signupData.pin !== signupData.confirmPin) {
      setError("PINs do not match");
      return;
    }

    if (!isLoaded) {
      setError("Authentication not ready. Please try again.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Step 1: Create Clerk user account with proper password
      const strongPassword = `${signupData.pin}EgyptFi2024!`;

      console.log("Creating Clerk user with email:", signupData.email);

      const clerkSignUpResult = await signUp.create({
        emailAddress: signupData.email,
        password: strongPassword,
      });

      console.log("Clerk signup result:", clerkSignUpResult);
      console.log("Status:", clerkSignUpResult.status);

      if (clerkSignUpResult.status === "complete") {
        // User created successfully without verification (email verification disabled)
        await setActive({ session: clerkSignUpResult.createdSessionId });

        const token = await getToken();
        const clerkUserId = clerkSignUpResult.createdUserId;

        console.log("Clerk user created:", clerkUserId);
        console.log("Token:", token);

        if (!clerkUserId || !token) {
          throw new Error("Failed to create authenticated session");
        }

        await registerMerchantAndCreateWallet(clerkUserId, token);
      } else if (clerkSignUpResult.status === "missing_requirements") {
        // Handle email verification requirement
        console.log("Email verification required");

        // Show email verification step
        setCurrentStep("email-verification");

        // Store the signup attempt for later completion
        setSignupAttempt(clerkSignUpResult);
      } else {
        throw new Error(
          `Unexpected signup status: ${clerkSignUpResult.status}`
        );
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError(
        err instanceof Error ? err.message : "An error occurred during signup"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailVerification = async () => {
    if (!signupAttempt || !verificationCode) {
      setError("Please enter the verification code");
      return;
    }

    if (!isLoaded || !signUp) {
      setError("Authentication not ready. Please try again.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Attempt email verification
      const verificationResult = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      console.log("Verification result:", verificationResult);

      if (verificationResult.status === "complete") {
        // Set the active session
        await setActive({ session: verificationResult.createdSessionId });

        // Get token and user ID
        const token = await getToken();
        const clerkUserId = verificationResult.createdUserId;

        console.log("Email verified! Clerk user:", clerkUserId);
        console.log("Token:", token);

        if (!clerkUserId || !token) {
          throw new Error(
            "Failed to create authenticated session after verification"
          );
        }

        // Proceed with merchant registration and wallet creation
        await registerMerchantAndCreateWallet(clerkUserId, token);
      } else {
        throw new Error("Email verification incomplete");
      }
    } catch (err: any) {
      console.error("Email verification error:", err);
      if (err.errors && err.errors.length > 0) {
        setError(err.errors[0].message || "Invalid verification code");
      } else {
        setError("Failed to verify email. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!signupAttempt || !isLoaded || !signUp) return;

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setError("");
      // You could show a success message here
    } catch (err) {
      console.error("Failed to resend verification email:", err);
      setError("Failed to resend verification email");
    }
  };

  const registerMerchantAndCreateWallet = async (
    clerkUserId: string,
    token: string | null
  ) => {
    try {
      // Register merchant with your backend
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      console.log(token);
      console.log(clerkUserId);
      console.log(signupData.pin);

      const merchantResponse = await fetch("/api/merchants/register", {
        method: "POST",
        headers,
        body: JSON.stringify({
          business_email: signupData.email,
          clerk_user_id: clerkUserId,
          pin: signupData.pin,
        }),
      });
      console.log(merchantResponse);

      if (!merchantResponse.ok) {
        const errorData = await merchantResponse.json();
        throw new Error(errorData.error || "Failed to register merchant");
      }

      const merchantData = await merchantResponse.json();
      setMerchantData(merchantData);

      // Create wallet
      setCurrentStep("wallet");

      const encryptKey = generateSecureEncryptKey();
      const network = "testnet";

      if (merchantData) {
        const walletResult = await createWalletWithMerchantUpdate(
          merchantData,
          createWalletAsync,
          setLoading,
          setError,
          {
            pin: signupData.pin,
            encryptKey,
            externalUserId: clerkUserId,
            network,
          },
          token
        );

        if (walletResult.success) {
          // Success - redirect to dashboard
          setTimeout(() => {
            onClose();
            router.push("/dashboard");
          }, 2000);
          console.log(walletResult);
        }
      } else {
        setError("Merchant data not available");
      }
    } catch (err) {
      console.error("Merchant registration error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to complete registration"
      );
    }
  };

  // useEffect(() => {}, [setMerchantData]);

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

      case "pin":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Create PIN
              </h3>
              <p className="text-muted-foreground">
                Choose a 6-digit PIN for your account
              </p>
            </div>
            <div className="space-y-2">
              {renderPinInputs(
                signupData.pin,
                (value) => handleInputChange("pin", value),
                pinRefs
              )}
            </div>
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Confirm PIN
              </h3>
              <p className="text-muted-foreground">
                Re-enter your PIN to confirm
              </p>
            </div>
            <div className="space-y-2">
              {renderPinInputs(
                signupData.confirmPin,
                (value) => handleInputChange("confirmPin", value),
                confirmPinRefs
              )}
            </div>
          </div>
        );

      case "email-verification":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Verify your email
              </h3>
              <p className="text-muted-foreground mb-4">
                We sent a verification code to {signupData.email}
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="text-center text-lg tracking-widest"
                  maxLength={6}
                />
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={resendVerificationEmail}
                  className="text-sm text-primary hover:underline"
                >
                  Didn't receive the code? Resend
                </button>
              </div>
            </div>
          </div>
        );

      case "wallet":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Wallet className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Creating your wallet address
              </h3>
              <p className="text-muted-foreground">
                Setting up your secure crypto wallet...
              </p>
            </div>
            <div className="flex justify-center">
              <div role="status">
                <svg
                  aria-hidden="true"
                  className="w-8 h-8 text-gray-200 animate-spin fill-[#d4af37]"
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
        {currentStep !== "wallet" && (
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
              onClick={
                currentStep === "confirm"
                  ? handleSignup
                  : currentStep === "email-verification"
                  ? handleEmailVerification
                  : handleNext
              }
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                currentStep === "email" ? (
                  "Checking Email..."
                ) : currentStep === "email-verification" ? (
                  "Verifying..."
                ) : (
                  "Creating Account..."
                )
              ) : currentStep === "confirm" ? (
                "Create Account"
              ) : currentStep === "email-verification" ? (
                "Verify Email"
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SignupModal;

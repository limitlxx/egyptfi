"use client";

import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, X } from "lucide-react";
import { verifyPin } from "@/lib/wallet-auth-integration"; // Adjust import path

interface PinVerificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (pin: string) => void; // Callback with verified plain PIN
  storedPinCode: string; // From privateinfo.pin_code
}

export const PinVerificationDialog: React.FC<PinVerificationDialogProps> = ({
  isOpen,
  onClose,
  onVerify,
  storedPinCode,
}) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const handleVerify = async () => {
    if (!pin || pin.length < 4) {
      setError("Enter a valid PIN (4-32 characters)");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await verifyPin(pin, storedPinCode);
      if (result.success) {
        onVerify(pin); // Pass plain PIN to parent
        onClose();
      } else {
        setError(result.error || "Invalid PIN");
        setPin(""); // Clear input on failure
      }
      setTimeout(() => pinRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError("Verification failed. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center flex items-center justify-center">
            <Lock className="h-5 w-5 mr-2" />
            Enter Your PIN
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Enter your 6-digit PIN to authorize this payment.
          </p>
          {renderPinInputs(pin, setPin, pinRefs)}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isVerifying}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={!pin || isVerifying}
              className="flex-1"
            >
              {isVerifying ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

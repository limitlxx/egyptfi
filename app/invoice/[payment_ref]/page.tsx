"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { InvoiceContent } from "@/components/invoice-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import PrismBackground from "@/components/prism-background";
import { get_payment } from "@/services/paymentService";

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const payment_ref = params.payment_ref as string;

  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  const handleGetStarted = () => {
    // For invoice page, perhaps redirect to home or do nothing
    router.push("/");
  };

  const scrollToSection = (sectionId: string) => {
    // For invoice page, no sections to scroll to
    // Could scroll to dialog or do nothing
  };

  useEffect(() => {
    if (!payment_ref) {
      setError("Invalid payment reference");
      setIsLoading(false);
      return;
    }

    fetchInvoiceData();
  }, [payment_ref]);

  const fetchInvoiceData = async () => {
    try {
      setIsLoading(true);

      // Fetch invoice data from the GET endpoint defined in route.ts
      const invoice = await get_payment(payment_ref);

      // Check if invoice has expired (24 hours)
      const createdAt = new Date(invoice.created_at);
      const expiryTime = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

      // TRY AGAIN
      if (new Date() > expiryTime) {
        setError("This payment link has expired");
        return;
      }

      // Check if already paid
      if (invoice.status === "paid") {
        router.push(`/confirm?ref=${payment_ref}`);
        return;
      }

      // Format currency symbol based on currency code
      const currencySymbol = invoice.currency === "NGN" ? "₦" : "$";

      // Format the invoice data for EnhancedInvoiceContent
      const formattedData = {
        merchantName: invoice.merchant_name,
        merchantLogo: invoice.merchant_logo,
        amountFiat: `${currencySymbol}${invoice.amount.toLocaleString()}`,
        invoiceId: `IE-${invoice.payment_ref}`,
        description: invoice.description || "Payment",
        paymentRef: invoice.payment_ref,
        hostedUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invoice?${payment_ref}`,
        secondaryEndpoint: invoice.secondary_endpoint,
        qrCode: invoice.qrCode,
        payUrl: invoice.paymentUrl,
        walletUrl: invoice.walletUrl,
        currency: invoice.currency, // Ensure currency is included
        amount: invoice.amount, // Ensure amount is included
      };

      setInvoiceData(formattedData);
    } catch (err) {
      console.error("Error fetching invoice:", err);
      setError("Failed to load payment information");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentConfirmed = async (paymentRef: string) => {
    try {
      // Update invoice status to paid in database
      await fetch(`/api/payments/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_ref: paymentRef,
          status: "paid",
          paid_at: new Date().toISOString(),
          // Optionally include transaction hash or other details
        }),
      });
    } catch (error) {
      console.error("Failed to update payment status:", error);
    }
  };

  if (isLoading) {
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
            pointerEvents: "none",
          }}
        >
          <PrismBackground
            animationType="3drotate"
            timeScale={0.5}
            height={3.5}
            baseWidth={4.5}
            scale={3.6}
            hueShift={0.125}
            colorFrequency={0.8}
            noise={0.2}
            glow={0.5}
          />
        </div>

        {/* Navbar */}
        <Navbar
          onGetStarted={handleGetStarted}
          onScrollToSection={scrollToSection}
        />

        <div className="relative z-10 flex items-center justify-center min-h-screen pt-32 pb-16">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">
              Loading payment information...
            </p>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    );
  }

  if (error) {
    console.log("ERROR", error);

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
            pointerEvents: "none",
          }}
        >
          <PrismBackground
            animationType="3drotate"
            timeScale={0.5}
            height={3.5}
            baseWidth={4.5}
            scale={3.6}
            hueShift={0.125}
            colorFrequency={0.8}
            noise={0.2}
            glow={0.5}
          />
        </div>

        {/* Navbar */}
        <Navbar
          onGetStarted={handleGetStarted}
          onScrollToSection={scrollToSection}
        />

        {/* Back to Home Button */}
        <div className="absolute top-20 left-4 z-20">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">← Back to Home</Link>
          </Button>
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen pt-32 pb-16">
          <div className="text-center max-w-md mx-auto p-6">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Payment Error
            </h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Secured by{" "}
              <Link
                href="/"
                className="text-primary hover:text-primary/90 font-medium ml-1"
              >
                EgyptFi
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    );
  }

  if (!invoiceData) {
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
            pointerEvents: "none",
          }}
        >
          <PrismBackground
            animationType="3drotate"
            timeScale={0.5}
            height={3.5}
            baseWidth={4.5}
            scale={3.6}
            hueShift={0.125}
            colorFrequency={0.8}
            noise={0.2}
            glow={0.5}
          />
        </div>

        {/* Navbar */}
        <Navbar
          onGetStarted={handleGetStarted}
          onScrollToSection={scrollToSection}
        />

        {/* Back to Home Button */}
        <div className="absolute top-20 left-4 z-20">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">← Back to Home</Link>
          </Button>
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen pt-32 pb-16">
          <p className="text-muted-foreground">No payment data found</p>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    );
  }

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
          pointerEvents: "none",
        }}
      >
        <PrismBackground
          animationType="3drotate"
          timeScale={0.5}
          height={3.5}
          baseWidth={4.5}
          scale={3.6}
          hueShift={0.125}
          colorFrequency={0.8}
          noise={0.2}
          glow={0.5}
        />
      </div>

      {/* Navbar */}
      <Navbar
        onGetStarted={handleGetStarted}
        onScrollToSection={scrollToSection}
      />

      {/* Back to Home Button */}
      <div className="absolute top-20 left-4 z-20">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">← Back to Home</Link>
        </Button>
      </div>

      {/* Main Content */}
      <main className="relative z-10 pt-32 pb-16">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent
            className="max-w-3xl w-[95vw] max-h-[95vh] p-0 overflow-hidden overflow-y-auto"
            onInteractOutside={(e) => e.preventDefault()} // disable outside click close
            onEscapeKeyDown={(e) => e.preventDefault()} // disable escape key close (optional)
          >
            <VisuallyHidden>
              <DialogTitle>Invoice Payment</DialogTitle>
            </VisuallyHidden>
            <InvoiceContent
              invoiceData={invoiceData}
              onPaymentConfirmed={handlePaymentConfirmed}
            />
          </DialogContent>
        </Dialog>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

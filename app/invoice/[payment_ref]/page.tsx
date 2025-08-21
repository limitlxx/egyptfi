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

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const payment_ref = params.payment_ref as string;

  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

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
      const response = await fetch(
        `/api/payments/initiate?payment_ref=${payment_ref}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError("Payment not found or has expired");
        } else {
          setError("Failed to load payment information");
        }
        return;
      }

      const result = await response.json();
      const invoice = result.data;

      // Check if invoice has expired (24 hours)
      const createdAt = new Date(invoice.created_at);
      const expiryTime = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

      // TRY AGAIN
      // if (new Date() > expiryTime) {
      //   setError("This payment link has expired");
      //   return;
      // }

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
        hostedUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invoice/${payment_ref}`,
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

      console.log("Payment confirmed for ref:", paymentRef);
    } catch (error) {
      console.error("Failed to update payment status:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading payment information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.log("ERROR", error);

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Payment Error
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="absolute top-4 left-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              asChild
            >
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
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
              className="text-blue-600 hover:text-blue-700 font-medium ml-1"
            >
              EgyptFi
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">No payment data found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      {/* <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="font-semibold text-gray-900">EgyptFi Pay</span>
            </div>
            <div className="text-sm text-gray-500">Secure Payment</div>
          </div>
        </div>
      </div> */}

      {/* Main Content */}
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
    </div>
  );
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { InvoiceContent } from "@/components/invoice-content"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function InvoiceModalPage() {
  const [isOpen, setIsOpen] = useState(true) // Open by default for demo purposes

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-8 px-4">
      {/* Header for the demo page, outside the modal */}
      <div className="absolute top-4 left-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button>Open Invoice</Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[95vh] p-0 overflow-hidden overflow-y-auto">
          <InvoiceContent />
        </DialogContent>
      </Dialog>

      {/* Footer similar to Paystack's "Secured by" */}
      <div className="text-center mt-8 text-sm text-gray-500">
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
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium ml-1">
            Egyptfi
          </Link>
        </p>
      </div>
    </div>
  )
}

// hooks/usePaymentInitiate.ts
import { useState } from 'react'

interface PaymentInitiateRequest {
  payment_ref: string
  local_amount: number
  local_currency: string
  description?: string
  chain?: string
  secondary_endpoint?: string
}

interface InvoiceData {
  payment_ref: string
  invoice_id: string
  merchant_name: string
  merchant_logo: string
  amount_fiat: number
  amount_fiat_formatted: string
  local_currency: string
  amount_usd: number
  description: string
  chains: Array<{ id: string; name: string; supported: boolean }>
  tokens: Record<string, Array<{ id: string; name: string; amount: string }>>
  wallet_addresses: Record<string, string>
  default_chain: string
  payment_link: string
  secondary_endpoint?: string
  status: string
  created_at: string
  expires_at: string
}

export function usePaymentInitiate() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)

  const initiatePayment = async (data: PaymentInitiateRequest) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to initiate payment')
      }

      const result = await response.json()
      setInvoiceData(result.data)
      return result.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    initiatePayment,
    isLoading,
    error,
    invoiceData,
    setInvoiceData,
  }
}
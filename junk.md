```js

// Example usage component showing how to integrate everything
export function PaymentInitiateExample() {
  const { initiatePayment, isLoading, error, invoiceData } = usePaymentInitiate()
  const [showModal, setShowModal] = useState(false)

  const handleInitiatePayment = async () => {
    try {
      const data = await initiatePayment({
        payment_ref: `ref-${Date.now()}`,
        local_amount: 5000,
        local_currency: 'NGN',
        description: 'Coffee Shop Purchase',
        chain: 'ethereum',
        secondary_endpoint: 'https://your-webhook-endpoint.com/payment-updates'
      })
      
      setShowModal(true)
    } catch (err) {
      console.error('Failed to initiate payment:', err)
    }
  }

  const handlePaymentConfirmed = (paymentRef: string) => {
    console.log('Payment confirmed for ref:', paymentRef)
    setShowModal(false)
    // Handle successful payment (e.g., redirect, show success message, etc.)
  }

  return (
    <div>
      <Button onClick={handleInitiatePayment} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Initiating Payment...
          </>
        ) : (
          'Initiate Payment'
        )}
      </Button>
      
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Your modal component would go here */}
      {showModal && invoiceData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
            <InvoiceContent 
              invoiceData={invoiceData} 
              onPaymentConfirmed={handlePaymentConfirmed}
            />
          </div>
        </div>
      )}
    </div>
  )
}


```
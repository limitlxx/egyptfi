import { Card } from "@/components/ui/card"
import Image from "next/image"

interface CartItem {
  name: string
  description: string
  icon: string
  price: string
  quantity: number
}

interface ShoppingCartProps {
  merchantName: string
  merchantLogo: string
  items: CartItem[]
  subtotal: string
  tax: string
  total: string
}

export function ShoppingCart({ merchantName, merchantLogo, items, subtotal, tax, total }: ShoppingCartProps) {
  return (
    <Card className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl mx-auto border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
            {/* <span className="text-white font-bold">{merchantLogo}</span> */}
            <Image
            src="/product.png"
            alt="Egyptfi Official Logo"
            width={150}
            height={150}  
            priority
            className="rounded-full"
          />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{merchantName}</h3>
            <p className="text-sm text-gray-500">Shopping Cart</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          {/* <p className="text-sm text-gray-500">≈ 3.2 USDC</p> */}
        </div>
      </div>

      {/* Shopping Cart Items */}
      <div className="space-y-3 mb-6">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm">{item.icon}</div>
              <div>
                <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-900">{item.price}</p>
              <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Total and Checkout */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium">{subtotal}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Tax</span>
          <span className="font-medium">{tax}</span>
        </div>
        <div className="border-t pt-2 flex justify-between items-center">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-bold text-gray-900">{total}</span>
        </div>
      </div>
    </Card>
  )
}
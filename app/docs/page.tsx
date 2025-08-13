"use client"

import { useState } from "react"
import { ArrowLeft, Copy, Check, Play, Code, Book, Zap, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"

export default function DocsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const endpoints = [
    {
      method: "POST",
      endpoint: "/api/payment/initiate",
      description: "Create new invoice from merchant dashboard",
      params: [
        { name: "amount", type: "number", required: true, description: "Amount in local currency" },
        { name: "currency", type: "string", required: true, description: "Local currency code (NGN, USD, EUR)" },
        { name: "description", type: "string", required: false, description: "Payment description" },
        { name: "webhook_url", type: "string", required: false, description: "Callback URL for payment updates" },
      ],
      response: {
        payment_ref: "pay_abc123",
        hosted_url: "https://pay.nummus.xyz/pay_abc123",
        qr_code: "data:image/png;base64,iVBOR...",
        expires_at: "2024-01-15T10:30:00Z",
      },
    },
    {
      method: "GET",
      endpoint: "/api/payment/:ref",
      description: "Fetch invoice metadata for pay/:ref",
      params: [{ name: "ref", type: "string", required: true, description: "Payment reference ID" }],
      response: {
        payment_ref: "pay_abc123",
        amount: 5000,
        currency: "NGN",
        description: "Premium Coffee Blend x2",
        status: "pending",
        crypto_amounts: {
          ethereum: { usdc: "3.2", eth: "0.0013", dai: "3.18" },
          starknet: { usdc: "3.2", eth: "0.0013" },
          polygon: { usdc: "3.2", matic: "4.1", dai: "3.18" },
        },
        created_at: "2024-01-15T09:30:00Z",
        expires_at: "2024-01-15T10:30:00Z",
      },
    },
    {
      method: "POST",
      endpoint: "/api/payment/confirm",
      description: "Manual confirmation with transaction hash",
      params: [
        { name: "payment_ref", type: "string", required: true, description: "Payment reference ID" },
        { name: "tx_hash", type: "string", required: true, description: "Blockchain transaction hash" },
        {
          name: "chain",
          type: "string",
          required: true,
          description: "Blockchain network (ethereum, starknet, polygon)",
        },
        { name: "token", type: "string", required: true, description: "Token used for payment" },
      ],
      response: {
        success: true,
        payment_ref: "pay_abc123",
        status: "confirmed",
        tx_hash: "0x1234567890abcdef...",
        settlement: {
          amount: "3.2",
          token: "USDC",
          chain: "starknet",
          tx_hash: "0xabcdef1234567890...",
        },
      },
    },
    {
      method: "POST",
      endpoint: "/api/payment/webhook/:merchantId",
      description: "Callback to merchant on payment success",
      params: [{ name: "merchantId", type: "string", required: true, description: "Merchant identifier" }],
      response: {
        event: "payment.confirmed",
        payment_ref: "pay_abc123",
        amount: 5000,
        currency: "NGN",
        crypto_paid: { amount: "3.2", token: "USDC", chain: "ethereum" },
        settlement: { amount: "3.2", token: "USDC", chain: "starknet" },
        tx_hash: "0x1234567890abcdef...",
        timestamp: "2024-01-15T09:35:00Z",
      },
    },
    {
      method: "GET",
      endpoint: "/api/prices/:token",
      description: "Get current token price in various currencies",
      params: [
        { name: "token", type: "string", required: true, description: "Token symbol (USDC, ETH, DAI, MATIC)" },
        { name: "currencies", type: "string", required: false, description: "Comma-separated currency codes" },
      ],
      response: {
        token: "USDC",
        prices: {
          NGN: 1562.5,
          USD: 1.0,
          EUR: 0.92,
          GBP: 0.79,
        },
        last_updated: "2024-01-15T09:30:00Z",
      },
    },
    {
      method: "GET",
      endpoint: "/api/rates",
      description: "List all supported tokens and their conversion rates",
      params: [],
      response: {
        chains: {
          ethereum: {
            tokens: ["USDC", "ETH", "DAI"],
            gas_sponsored: true,
          },
          starknet: {
            tokens: ["USDC", "ETH"],
            gas_sponsored: true,
          },
          polygon: {
            tokens: ["USDC", "MATIC", "DAI"],
            gas_sponsored: true,
          },
        },
        rates: {
          USDC: { NGN: 1562.5, USD: 1.0, EUR: 0.92 },
          ETH: { NGN: 3906250, USD: 2500, EUR: 2300 },
          DAI: { NGN: 1560, USD: 0.998, EUR: 0.918 },
          MATIC: { NGN: 1218.75, USD: 0.78, EUR: 0.718 },
        },
        last_updated: "2024-01-15T09:30:00Z",
      },
    },
  ]

  const codeExamples = {
    curl: {
      initiate: `curl -X POST https://api.nummus.xyz/api/payment/initiate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "currency": "NGN",
    "description": "Premium Coffee Blend x2",
    "webhook_url": "https://yoursite.com/webhook"
  }'`,
      fetch: `curl -X GET https://api.nummus.xyz/api/payment/pay_abc123 \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      confirm: `curl -X POST https://api.nummus.xyz/api/payment/confirm \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "payment_ref": "pay_abc123",
    "tx_hash": "0x1234567890abcdef...",
    "chain": "ethereum",
    "token": "USDC"
  }'`,
    },
    javascript: {
      initiate: `const response = await fetch('https://api.nummus.xyz/api/payment/initiate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 5000,
    currency: 'NGN',
    description: 'Premium Coffee Blend x2',
    webhook_url: 'https://yoursite.com/webhook'
  })
});

const payment = await response.json();
console.log(payment.hosted_url);`,
      fetch: `const response = await fetch('https://api.nummus.xyz/api/payment/pay_abc123', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
  }
});

const invoice = await response.json();
console.log(invoice.crypto_amounts);`,
      confirm: `const response = await fetch('https://api.nummus.xyz/api/payment/confirm', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    payment_ref: 'pay_abc123',
    tx_hash: '0x1234567890abcdef...',
    chain: 'ethereum',
    token: 'USDC'
  })
});

const confirmation = await response.json();`,
    },
    python: {
      initiate: `import requests

response = requests.post(
    'https://api.nummus.xyz/api/payment/initiate',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'amount': 5000,
        'currency': 'NGN',
        'description': 'Premium Coffee Blend x2',
        'webhook_url': 'https://yoursite.com/webhook'
    }
)

payment = response.json()
print(payment['hosted_url'])`,
      fetch: `import requests

response = requests.get(
    'https://api.nummus.xyz/api/payment/pay_abc123',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)

invoice = response.json()
print(invoice['crypto_amounts'])`,
      confirm: `import requests

response = requests.post(
    'https://api.nummus.xyz/api/payment/confirm',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'payment_ref': 'pay_abc123',
        'tx_hash': '0x1234567890abcdef...',
        'chain': 'ethereum',
        'token': 'USDC'
    }
)

confirmation = response.json()`,
    },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Nummus API</span>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            Get API Key
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            <Book className="w-4 h-4 mr-2" />
            API Documentation
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Build with{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Nummus API
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Integrate crypto payments into your application with our RESTful API. Accept payments across multiple
            blockchains and receive USDC settlements automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600">
              <Play className="w-4 h-4 mr-2" />
              Try in Playground
            </Button>
            <Button variant="outline" size="lg" className="bg-transparent">
              <Code className="w-4 h-4 mr-2" />
              View Examples
            </Button>
          </div>
        </div>

        {/* Quick Start */}
        <Card className="mb-12 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2 text-blue-600" />
              Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <h3 className="font-semibold mb-2">Get API Key</h3>
                <p className="text-sm text-gray-600">Sign up and get your API key from the merchant dashboard</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-600 font-bold">2</span>
                </div>
                <h3 className="font-semibold mb-2">Create Payment</h3>
                <p className="text-sm text-gray-600">Use the initiate endpoint to create a new payment invoice</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-600 font-bold">3</span>
                </div>
                <h3 className="font-semibold mb-2">Handle Webhooks</h3>
                <p className="text-sm text-gray-600">Receive real-time payment confirmations via webhooks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card className="mb-12 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2 text-green-600" />
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              All API requests require authentication using your API key in the Authorization header:
            </p>
            <div className="bg-gray-900 rounded-lg p-4 relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
                onClick={() => copyCode("Authorization: Bearer YOUR_API_KEY", "auth")}
              >
                {copiedCode === "auth" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <code className="text-green-400 text-sm">Authorization: Bearer YOUR_API_KEY</code>
            </div>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Security Note:</strong> Never expose your API key in client-side code. Always make API calls
                from your server.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Endpoints */}
        <div className="space-y-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">API Endpoints</h2>

          {endpoints.map((endpoint, index) => (
            <Card key={index} className="shadow-lg border-0">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Badge
                    className={`${
                      endpoint.method === "POST" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {endpoint.method}
                  </Badge>
                  <code className="text-lg font-mono bg-gray-100 px-3 py-1 rounded">{endpoint.endpoint}</code>
                </div>
                <p className="text-gray-600 mt-2">{endpoint.description}</p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="parameters" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    <TabsTrigger value="response">Response</TabsTrigger>
                    <TabsTrigger value="examples">Examples</TabsTrigger>
                    <TabsTrigger value="try">Try It</TabsTrigger>
                  </TabsList>

                  <TabsContent value="parameters" className="mt-6">
                    {endpoint.params.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 font-semibold">Parameter</th>
                              <th className="text-left py-2 font-semibold">Type</th>
                              <th className="text-left py-2 font-semibold">Required</th>
                              <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {endpoint.params.map((param, paramIndex) => (
                              <tr key={paramIndex} className="border-b">
                                <td className="py-2">
                                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">{param.name}</code>
                                </td>
                                <td className="py-2 text-gray-600">{param.type}</td>
                                <td className="py-2">
                                  <Badge variant={param.required ? "default" : "secondary"}>
                                    {param.required ? "Required" : "Optional"}
                                  </Badge>
                                </td>
                                <td className="py-2 text-gray-600">{param.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No parameters required</p>
                    )}
                  </TabsContent>

                  <TabsContent value="response" className="mt-6">
                    <div className="bg-gray-900 rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-gray-400 hover:text-white"
                        onClick={() => copyCode(JSON.stringify(endpoint.response, null, 2), `response-${index}`)}
                      >
                        {copiedCode === `response-${index}` ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <pre className="text-green-400 text-sm overflow-x-auto">
                        {JSON.stringify(endpoint.response, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>

                  <TabsContent value="examples" className="mt-6">
                    <Tabs defaultValue="curl" className="w-full">
                      <TabsList>
                        <TabsTrigger value="curl">cURL</TabsTrigger>
                        <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                        <TabsTrigger value="python">Python</TabsTrigger>
                      </TabsList>

                      {["curl", "javascript", "python"].map((lang) => (
                        <TabsContent key={lang} value={lang} className="mt-4">
                          <div className="bg-gray-900 rounded-lg p-4 relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2 text-gray-400 hover:text-white"
                              onClick={() => {
                                const codeKey = endpoint.endpoint.includes("initiate")
                                  ? "initiate"
                                  : endpoint.endpoint.includes(":ref")
                                    ? "fetch"
                                    : "confirm"
                                copyCode(
                                  codeExamples[lang as keyof typeof codeExamples][
                                    codeKey as keyof (typeof codeExamples)[typeof lang]
                                  ],
                                  `${lang}-${index}`,
                                )
                              }}
                            >
                              {copiedCode === `${lang}-${index}` ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            <pre className="text-green-400 text-sm overflow-x-auto">
                              {endpoint.endpoint.includes("initiate")
                                ? codeExamples[lang as keyof typeof codeExamples].initiate
                                : endpoint.endpoint.includes(":ref")
                                  ? codeExamples[lang as keyof typeof codeExamples].fetch
                                  : codeExamples[lang as keyof typeof codeExamples].confirm}
                            </pre>
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </TabsContent>

                  <TabsContent value="try" className="mt-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                      <Code className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                      <h3 className="font-semibold text-blue-900 mb-2">Interactive API Playground</h3>
                      <p className="text-blue-700 mb-4">
                        Test this endpoint with real parameters in our interactive playground
                      </p>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Play className="w-4 h-4 mr-2" />
                        Open in Playground
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Webhooks Section */}
        <Card className="mt-12 shadow-lg border-0">
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Nummus sends webhook notifications to your specified URL when payment events occur. Configure your webhook
              URL in the merchant dashboard or when creating a payment.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-semibold mb-2">Webhook Events</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <Badge variant="secondary" className="mr-2">
                    payment.confirmed
                  </Badge>
                  Payment has been confirmed on blockchain
                </li>
                <li className="flex items-center">
                  <Badge variant="secondary" className="mr-2">
                    payment.settled
                  </Badge>
                  USDC has been settled to merchant wallet
                </li>
                <li className="flex items-center">
                  <Badge variant="secondary" className="mr-2">
                    payment.failed
                  </Badge>
                  Payment failed or expired
                </li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Security:</strong> Always verify webhook signatures using the provided secret key to ensure
                authenticity.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card className="mt-8 shadow-lg border-0">
          <CardHeader>
            <CardTitle>Rate Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-2">100</div>
                <p className="text-sm text-gray-600">Requests per minute</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-2">1000</div>
                <p className="text-sm text-gray-600">Requests per hour</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 mb-2">10000</div>
                <p className="text-sm text-gray-600">Requests per day</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

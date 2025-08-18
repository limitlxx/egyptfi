"use client"

import { useEffect, useState } from "react"
import { ArrowDownToLine, ExternalLink, Copy, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WithdrawalService, Withdrawal } from "@/services/withdrawalService"

export function WithdrawalHistory() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedTx, setCopiedTx] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      const data = await WithdrawalService.getWithdrawals()
      setWithdrawals(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  const copyTxHash = async (txHash: string, id: string) => {
    await navigator.clipboard.writeText(txHash)
    setCopiedTx(id)
    setTimeout(() => setCopiedTx(null), 2000)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ArrowDownToLine className="w-5 h-5 mr-2 text-green-600" />
            Withdrawal History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Loading withdrawals...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center">
          <ArrowDownToLine className="w-5 h-5 mr-2 text-green-600" />
          Withdrawal History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {withdrawals.map((withdrawal) => (
            <div key={withdrawal.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <ArrowDownToLine className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{withdrawal.amount} USDC</p>
                    <p className="text-sm text-gray-500">{withdrawal.date}</p>
                  </div>
                </div>
                <Badge className={getStatusColor(withdrawal.status)}>{withdrawal.status}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                    {withdrawal.txHash.slice(0, 10)}...{withdrawal.txHash.slice(-8)}
                  </code>
                  {withdrawal.gasSponsored && (
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                      Gas Sponsored
                    </Badge>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => copyTxHash(withdrawal.txHash, withdrawal.id)}>
                    {copiedTx === withdrawal.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`https://etherscan.io/tx/${withdrawal.txHash}`, "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {withdrawals.length === 0 && (
          <div className="text-center py-8">
            <ArrowDownToLine className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No withdrawals yet</p>
            <p className="text-sm text-gray-400">Your withdrawal history will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

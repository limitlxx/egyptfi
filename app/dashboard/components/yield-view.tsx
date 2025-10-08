"use client"

import { useState } from "react"
import { Search, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const yieldStrategies = [
  {
    id: "egyptfi-high",
    name: "EgyptFi High Yield",
    protocol: "EgyptFi",
    vaultAllocation: "$5,000",
    poolAllocation: "$2,500",
    currentYield: "5.2%",
    projectedEarnings: "$390",
    risk: "Medium",
    description: "Balanced strategy with exposure to both vault and pool",
  },
  {
    id: "genesis-prime",
    name: "Genesis Prime Yield",
    protocol: "Genesis",
    vaultAllocation: "$3,000",
    poolAllocation: "$1,000",
    currentYield: "7.8%",
    projectedEarnings: "$312",
    risk: "High",
    description: "Higher yield with increased vault allocation",
  },
  {
    id: "r7b-secure",
    name: "r7b Secure Yield",
    protocol: "r7b",
    vaultAllocation: "$1,000",
    poolAllocation: "0",
    currentYield: "4.5%",
    projectedEarnings: "$45",
    risk: "Low",
    description: "Conservative vault-only strategy",
  },
]

export default function YieldOptionsPage() {
  const [activeTab, setActiveTab] = useState<"all" | "my-options">("my-options")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null)

  const protocols = ["EgyptFi", "Genesis", "r7b", "Chipipay", "Troves"]

  const filteredStrategies = yieldStrategies.filter((strategy) => {
    const matchesSearch = strategy.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesProtocol = !selectedProtocol || strategy.protocol === selectedProtocol
    return matchesSearch && matchesProtocol
  })

  const totalInvested = yieldStrategies.reduce((sum, strategy) => {
    const vault = Number.parseFloat(strategy.vaultAllocation.replace(/[$,]/g, ""))
    const pool = Number.parseFloat(strategy.poolAllocation.replace(/[$,]/g, ""))
    return sum + vault + pool
  }, 0)

  return (
    <div className="min-h-screen  "> 
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Yield Options</h1>
          <p className="text-slate-400">Explore and manage your yield farming strategies</p>
        </div>

        {/* Tabs */}
        {/* <div className="flex gap-6 mb-6 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === "all" ? "text-white" : "text-slate-400 hover:text-slate-300"
            }`}
          >
            All
            {activeTab === "all" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab("my-options")}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === "my-options" ? "text-white" : "text-slate-400 hover:text-slate-300"
            }`}
          >
            My Options
            {activeTab === "my-options" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        </div> */}

        {/* Search Bar */}
        {/* <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search yield options"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
        </div> */}

        {/* Protocol Filters */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {protocols.map((protocol) => (
            <Badge
              key={protocol}
              variant={selectedProtocol === protocol ? "default" : "outline"}
              className={`cursor-pointer px-4 py-1.5 ${
                selectedProtocol === protocol
                  ? "bg-info-600 text-white hover:bg-info-700"
                  : "bg-primary-900 text-primary-300 border-primary-700 hover:bg-primary-800"
              }`}
              onClick={() => setSelectedProtocol(selectedProtocol === protocol ? null : protocol)}
            >
              {protocol}
            </Badge>
          ))}
        </div>

        {/* My Yield Options Overview */}
        <div className="mb-8">
          {/* <h2 className="text-2xl font-bold text-white mb-4">My Yield Options Overview</h2> */}
          <Card className="border-primary-800">
            <CardContent className="p-6">
              <div className="mb-6">
                <p className="text-slate-400 text-sm mb-1">Total Invested</p>
                <p className="text-3xl font-bold text-white">${totalInvested.toLocaleString()}</p>
              </div>

              {/* Strategies Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-primary-800">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Name</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Vault Allocation</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Pool Allocation</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Current Yield</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Projected Earnings</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStrategies.map((strategy) => (
                      <tr key={strategy.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-white font-medium">{strategy.name}</p>
                            <p className="text-slate-500 text-sm">{strategy.description}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-white">{strategy.vaultAllocation}</td>
                        <td className="py-4 px-4 text-white">{strategy.poolAllocation}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1 text-green-400">
                            <TrendingUp className="w-4 h-4" />
                            <span className="font-medium">{strategy.currentYield}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-white font-medium">{strategy.projectedEarnings}</td>
                        <td className="py-4 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                            asChild
                          >
                            <Link href={`/yield/${strategy.id}`}>Manage</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { ArrowLeft, TrendingUp, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import Image from "next/image";

const performanceData = [
  { month: "Jan", value: 12000 },
  { month: "Feb", value: 12100 },
  { month: "Mar", value: 12300 },
  { month: "Apr", value: 12200 },
  { month: "May", value: 12345 },
  { month: "Jun", value: 12400 },
  { month: "Jul", value: 12500 },
]

const aprData = [
  { month: "Jan", value: 4.2 },
  { month: "Feb", value: 4.0 },
  { month: "Mar", value: 4.3 },
  { month: "Apr", value: 4.1 },
  { month: "May", value: 4.05 },
  { month: "Jun", value: 4.2 },
  { month: "Jul", value: 4.3 },
]

const positions = [
  { vault: "USDC", principal: "$600.00", apr: "4.1%", earnings: "$12.00", status: "active" },
  { vault: "Pool", principal: "$400.00", apr: "5.0%", earnings: "$8.00", status: "active" },
]

const activityLog = [
  { date: "2023-07-30", type: "Deposit", amount: "$400", status: "Completed" },
  { date: "2023-07-15", type: "Deposit", amount: "$600", status: "Completed" },
  { date: "2023-07-01", type: "Claim", amount: "$20", status: "Completed" },
]

export default function YieldDashboardPage() {
  const [depositAllocation, setDepositAllocation] = useState([60])
  const [autoCompound, setAutoCompound] = useState(true)

  const vaultAllocation = depositAllocation[0]
  const poolAllocation = 100 - vaultAllocation

  return (
    <div className="min-h-screen">
      {/* Header */}
       <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center">
              <Image
                src="/egyptfi_logo-03.png"
                alt="EGYPTFI"
                width={840}
                height={280}
                className="h-56 w-auto dark:hidden"
              />
              <Image
                src="/egyptfi_white-03.png"
                alt="EGYPTFI"
                width={840}
                height={280}
                className="h-56 w-auto hidden dark:block"
              />
            </Link>
            <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
              <span>/</span>
              <span>yield dashboard</span>
            </div>
          </div>
          {/* LOGO */}
          {/* <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-sm">
              {typeof businessLogo === "string" &&
              businessLogo.startsWith("/") ? (
                <img
                  src={businessLogo}
                  alt="Business logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                businessLogo
              )}
            </div>
            <span className="font-medium text-foreground">{businessName}</span>
            {isConnected && (
              <Button variant="outline" size="sm" className="text-xs">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </Button>
            )}
          </div> */}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Button */}
        <Button variant="ghost" className="mb-6 text-slate-400 hover:text-white" asChild>
          <Link href="./dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Yield Options
          </Link>
        </Button>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Yield Dashboard</h1>
          <p className="text-slate-400">Manage your EgyptFi High Yield strategy</p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-primary-900  border-slate-800">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm mb-1">Total Pool Supplied</p>
              <p className="text-2xl font-bold text-white">$12,345</p>
            </CardContent>
          </Card>
          <Card className="bg-primary-900  border-slate-800">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm mb-1">Your Pool Supply</p>
              <p className="text-2xl font-bold text-white">$400</p>
            </CardContent>
          </Card>
          <Card className="bg-primary-900  border-slate-800">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm mb-1">Your Vault Balance</p>
              <p className="text-2xl font-bold text-white">$600</p>
            </CardContent>
          </Card>
          <Card className="bg-primary-900  border-slate-800">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm mb-1">Your Yield</p>
              <p className="text-2xl font-bold text-white">$600</p>
            </CardContent>
          </Card>
          <Card className="bg-primary-900  border-slate-800">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm mb-1">Current APR</p>
              <p className="text-2xl font-bold text-green-400">4.05%</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Allocation & Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Allocation & Controls */}
            <Card className="bg-primary-900  border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Allocation & Controls</h3>

                {/* Deposit Allocation Slider */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-400 text-sm">Deposit Allocation Slider</label>
                    <Info className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="mb-4">
                    <Slider
                      value={depositAllocation}
                      onValueChange={setDepositAllocation}
                      max={100}
                      step={1}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-400">Vault: {vaultAllocation}%</span>
                      <span className="text-purple-400">Pool: {poolAllocation}%</span>
                    </div>
                  </div>
                </div>

                {/* Auto-compound Toggle */}
                <div className="flex items-center justify-between mb-6 p-4 bg-slate-800/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Auto-compound Vault</p>
                    <p className="text-slate-400 text-sm">Yield ON/OFF</p>
                  </div>
                  <Switch checked={autoCompound} onCheckedChange={setAutoCompound} />
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button className="w-full border-slate hover:bg-slate-700 text-dark">600 USDC Claimable</Button>
                  
                </div>
              </CardContent>
            </Card>

            {/* Pool Utilization */}
            <Card className="bg-primary-900  border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Pool Utilization</h3>
                <div className="text-center">
                  <p className="text-4xl font-bold text-white mb-2">44.1%</p>
                  <p className="text-slate-400 text-sm">of pool capacity used</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Portfolio & Performance */}
          <div className="lg:col-span-2 space-y-6">
            {/* Portfolio Overview */}
            <Card className="bg-primary-900  border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Portfolio Overview</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Vault balance</span>
                    <span className="text-white font-medium">$600</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Pool balance</span>
                    <span className="text-white font-medium">$400</span>
                  </div>
                  <div className="h-px bg-slate-800" />
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total balance</span>
                    <span className="text-white font-bold text-lg">$1,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Yield and Performance */}
            <Card className="bg-primary-900  border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Yield and Performance</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Yield Growth */}
                  <div>
                    <div className="mb-4">
                      <p className="text-slate-400 text-sm mb-1">Yield Growth</p>
                      <p className="text-3xl font-bold text-white">$12,345</p>
                      <p className="text-green-400 text-sm flex items-center gap-1 mt-1">
                        <TrendingUp className="w-4 h-4" />
                        Last 30 Days +3.5%
                      </p>
                    </div>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={performanceData}>
                        <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                          }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Performance Over Time */}
                  <div>
                    <div className="mb-4">
                      <p className="text-slate-400 text-sm mb-1">Performance Over Time</p>
                      <p className="text-3xl font-bold text-white">4.05%</p>
                      <p className="text-green-400 text-sm flex items-center gap-1 mt-1">
                        <TrendingUp className="w-4 h-4" />
                        Last 30 Days +0.5%
                      </p>
                    </div>
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={aprData}>
                        <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                          }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-slate-400 text-sm">
                    Projected Yield Reminder: Your yield is projected to grow by $X in the next month based on your
                    current allocation and APR.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Your Positions */}
            <Card className="bg-primary-900  border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Your Positions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-3 px-2 text-slate-400 font-medium text-sm">Vault</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium text-sm">Principal</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium text-sm">APR</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium text-sm">Yield Earned</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((position, index) => (
                        <tr key={index} className="border-b border-slate-800/50">
                          <td className="py-3 px-2 text-white">{position.vault}</td>
                          <td className="py-3 px-2 text-white">{position.principal}</td>
                          <td className="py-3 px-2 text-green-400">{position.apr}</td>
                          <td className="py-3 px-2 text-white">{position.earnings}</td>
                          <td className="py-3 px-2">
                            <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                              {position.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Activity Log */}
            <Card className="bg-primary-900  border-slate-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Activity Log</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-3 px-2 text-slate-400 font-medium text-sm">Date</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium text-sm">Type</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium text-sm">Amount</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLog.map((activity, index) => (
                        <tr key={index} className="border-b border-slate-800/50">
                          <td className="py-3 px-2 text-slate-400">{activity.date}</td>
                          <td className="py-3 px-2 text-white">{activity.type}</td>
                          <td className="py-3 px-2 text-white">{activity.amount}</td>
                          <td className="py-3 px-2">
                            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">{activity.status}</Badge>
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
    </div>
  )
}

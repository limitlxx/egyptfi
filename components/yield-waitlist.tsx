"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export function YieldWaitlist({ ctaText = "Join Waitlist", compact = false }: { ctaText?: string; compact?: boolean }) {
  const { toast } = useToast()
  const [email, setEmail] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast({
        title: "Enter a valid email",
        description: "We’ll notify you when Yield Farming is live.",
        variant: "destructive",
      })
      return
    }
    toast({
      title: "You're on the list!",
      description: "We’ll email you when Yield Farming launches.",
    })
    setEmail("")
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex w-full gap-2">
        <Input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white"
          aria-label="Email address"
        />
        <Button type="submit" className="bg-gradient-to-r from-blue-600 to-purple-600">
          {ctaText}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-2">
        <Label htmlFor="yield-waitlist-email">Email address</Label>
        <Input
          id="yield-waitlist-email"
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white"
        />
      </div>
      <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
        {ctaText}
      </Button>
      <p className="text-xs text-gray-500 text-center">
        No spam. We’ll only message you about Yield Farming availability.
      </p>
    </form>
  )
}

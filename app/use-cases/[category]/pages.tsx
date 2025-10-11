"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Github, Globe, Users, CreditCard, TrendingUp, Vote, Handshake } from "lucide-react"
import { notFound } from "next/navigation"

const categoryData = {
  community: {
    title: "Community",
    icon: Users,
    description: "Build and engage thriving communities with transparent, on-chain payment infrastructure.",
    projects: [
      {
        name: "DAOhaus",
        description: "Community treasury management with transparent on-chain governance and automated distributions.",
        image: "/dao-community-platform.jpg",
        tags: ["Treasury", "Governance", "DAO"],
        stats: { users: "50K+", volume: "$2M+", transactions: "100K+" },
        links: { website: "#", github: "#" },
      },
      {
        name: "Discord Tipping Bot",
        description: "Reward community members instantly with crypto tips directly in Discord channels.",
        image: "/discord-bot-crypto-tipping.jpg",
        tags: ["Social", "Rewards", "Bot"],
        stats: { users: "200K+", volume: "$500K+", transactions: "1M+" },
        links: { website: "#", github: "#" },
      },
      {
        name: "Creator Memberships",
        description: "Subscription-based memberships with crypto payments and exclusive content access.",
        image: "/creator-membership-platform.jpg",
        tags: ["Subscriptions", "Content", "NFT"],
        stats: { users: "10K+", volume: "$1M+", transactions: "50K+" },
        links: { website: "#" },
      },
    ],
  },
  payments: {
    title: "Payments",
    icon: CreditCard,
    description: "Accept crypto payments seamlessly with instant settlements and multi-chain support.",
    projects: [
      {
        name: "E-commerce Store",
        description: "Full-featured online store accepting crypto payments with automatic USDC conversion.",
        image: "/ecommerce-crypto-checkout.jpg",
        tags: ["Retail", "Multi-chain", "USDC"],
        stats: { users: "100K+", volume: "$5M+", transactions: "500K+" },
        links: { website: "#", github: "#" },
      },
      {
        name: "Subscription Service",
        description: "Recurring crypto payments for SaaS and subscription-based businesses.",
        image: "/subscription-payment-platform.jpg",
        tags: ["SaaS", "Recurring", "Automation"],
        stats: { users: "25K+", volume: "$3M+", transactions: "200K+" },
        links: { website: "#" },
      },
      {
        name: "Freelance Marketplace",
        description: "Escrow-based payments for freelancers with milestone releases and dispute resolution.",
        image: "/freelance-marketplace-crypto.jpg",
        tags: ["Escrow", "Freelance", "Milestones"],
        stats: { users: "75K+", volume: "$10M+", transactions: "300K+" },
        links: { website: "#", github: "#" },
      },
    ],
  },
  staking: {
    title: "Staking",
    icon: TrendingUp,
    description: "Earn passive yield on idle USDC balances through secure, on-chain staking strategies.",
    projects: [
      {
        name: "Yield Aggregator",
        description: "Automatically route funds to the highest-yielding strategies across multiple protocols.",
        image: "/yield-farming-aggregator.jpg",
        tags: ["DeFi", "Auto-compound", "Multi-protocol"],
        stats: { users: "15K+", volume: "$50M+", transactions: "75K+" },
        links: { website: "#", github: "#" },
      },
      {
        name: "Savings Vault",
        description: "Simple savings account with competitive APY and no lockup periods.",
        image: "/crypto-savings-vault.jpg",
        tags: ["Savings", "Flexible", "USDC"],
        stats: { users: "30K+", volume: "$20M+", transactions: "150K+" },
        links: { website: "#" },
      },
      {
        name: "Liquidity Pool",
        description: "Provide liquidity and earn trading fees plus additional rewards.",
        image: "/liquidity-pool-interface.jpg",
        tags: ["LP", "Trading Fees", "Rewards"],
        stats: { users: "8K+", volume: "$15M+", transactions: "40K+" },
        links: { website: "#", github: "#" },
      },
    ],
  },
  governance: {
    title: "Governance",
    icon: Vote,
    description: "Participate in decentralized decision-making with on-chain voting and transparent proposals.",
    projects: [
      {
        name: "Protocol Governance",
        description: "Token-weighted voting system for protocol upgrades and parameter changes.",
        image: "/governance-voting-interface.jpg",
        tags: ["Voting", "Proposals", "Token-weighted"],
        stats: { users: "20K+", volume: "N/A", transactions: "50K+" },
        links: { website: "#", github: "#" },
      },
      {
        name: "Treasury Management",
        description: "Community-controlled treasury with transparent fund allocation and spending.",
        image: "/treasury-management-dashboard.jpg",
        tags: ["Treasury", "Multi-sig", "Transparency"],
        stats: { users: "5K+", volume: "$30M+", transactions: "10K+" },
        links: { website: "#" },
      },
      {
        name: "Grant Program",
        description: "Decentralized grant distribution with community voting and milestone tracking.",
        image: "/grant-program-platform.jpg",
        tags: ["Grants", "Funding", "Milestones"],
        stats: { users: "12K+", volume: "$5M+", transactions: "25K+" },
        links: { website: "#", github: "#" },
      },
    ],
  },
  partnerships: {
    title: "Partnerships",
    icon: Handshake,
    description: "Collaborate with other protocols and businesses through secure, programmable payment infrastructure.",
    projects: [
      {
        name: "API Integration",
        description: "Full-featured API for seamless integration with existing business systems.",
        image: "/api-integration-dashboard.png",
        tags: ["API", "Webhooks", "Enterprise"],
        stats: { users: "500+", volume: "$100M+", transactions: "2M+" },
        links: { website: "#", github: "#" },
      },
      {
        name: "White Label Solution",
        description: "Customizable payment infrastructure for businesses to brand as their own.",
        image: "/white-label-payment-platform.jpg",
        tags: ["White Label", "Custom", "Branding"],
        stats: { users: "50+", volume: "$50M+", transactions: "500K+" },
        links: { website: "#" },
      },
      {
        name: "Cross-chain Bridge",
        description: "Enable seamless asset transfers between different blockchain networks.",
        image: "/cross-chain-bridge-interface.jpg",
        tags: ["Bridge", "Multi-chain", "Interoperability"],
        stats: { users: "40K+", volume: "$200M+", transactions: "300K+" },
        links: { website: "#", github: "#" },
      },
    ],
  },
}

export default function CategoryPage({ params }: { params: { category: string } }) {
  const category = categoryData[params.category as keyof typeof categoryData]

  if (!category) {
    notFound()
  }

  const Icon = category.icon

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-50 bg-black/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-sm">N</span>
            </div>
            <span className="text-xl font-bold">Nummus</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/docs" className="text-gray-400 hover:text-white transition-colors">
              Docs
            </Link>
            <Link href="/use-cases" className="text-white font-medium">
              Use Cases
            </Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
              Contact
            </Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Button variant="outline" className="border-white/20 hover:bg-white/10 bg-transparent" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black hover:from-amber-500 hover:to-yellow-700"
              asChild
            >
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Back Button */}
      <div className="container mx-auto px-4 pt-8">
        <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/10" asChild>
          <Link href="/use-cases">
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Use Cases
          </Link>
        </Button>
      </div>

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center space-x-6 mb-6"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center">
              <Icon className="w-10 h-10 text-black" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">{category.title}</h1>
              <p className="text-xl text-gray-400">{category.description}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {category.projects.map((project, index) => (
              <motion.div
                key={project.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="group"
              >
                <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-amber-400/50 hover:bg-gradient-to-br hover:from-amber-400/5 hover:to-yellow-600/5 transition-all duration-300">
                  {/* Project Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={project.image || "/placeholder.svg"}
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  </div>

                  {/* Project Content */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold mb-2">{project.name}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{project.description}</p>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Users</p>
                        <p className="text-sm font-semibold text-amber-400">{project.stats.users}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Volume</p>
                        <p className="text-sm font-semibold text-amber-400">{project.stats.volume}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Txns</p>
                        <p className="text-sm font-semibold text-amber-400">{project.stats.transactions}</p>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex gap-2 pt-2">
                      {project.links.website && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-white/20 hover:bg-white/10 bg-transparent"
                          asChild
                        >
                          <a href={project.links.website} target="_blank" rel="noopener noreferrer">
                            <Globe className="w-4 h-4 mr-2" />
                            Visit
                          </a>
                        </Button>
                      )}
                      {project.links.github && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-white/20 hover:bg-white/10 bg-transparent"
                          asChild
                        >
                          <a href={project.links.github} target="_blank" rel="noopener noreferrer">
                            <Github className="w-4 h-4 mr-2" />
                            Code
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/10 p-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Build Your Own Project</h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Start building with Nummus today and join the ecosystem of innovative projects.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black hover:from-amber-500 hover:to-yellow-700 px-8"
                asChild
              >
                <Link href="/signup">
                  Get Started
                  <ExternalLink className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 hover:bg-white/10 px-8 bg-transparent"
                asChild
              >
                <Link href="/docs">View Documentation</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">N</span>
              </div>
              <span className="text-xl font-bold">Nummus</span>
            </div>
            <p className="text-gray-400 text-sm">© 2025 Nummus. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

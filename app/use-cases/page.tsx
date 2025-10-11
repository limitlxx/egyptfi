"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Users, CreditCard, TrendingUp, Vote, Handshake, ChevronDown, Globe, Github } from "lucide-react"

const categoryData = {
  community: {
    title: "Community",
    icon: Users,
    description:
      "Build and engage thriving communities with transparent, on-chain payment infrastructure that empowers members.",
    projects: [
      {
        name: "The Buidl",
        description: "Community treasury management with transparent on-chain governance and automated distributions.",
        image: "/dao-community-platform.jpg",
        tags: ["Treasury", "Governance", "DAO"],
        stats: { users: "50K+", volume: "$2M+", transactions: "100K+" },
        links: { website: "https://daohaus.club", github: "https://github.com/HausDAO" },
      }, 
    ],
  },
  payments: {
    title: "Payments",
    icon: CreditCard,
    description:
      "Accept crypto payments seamlessly with instant USDC settlements, multi-chain support, and zero gas fees for customers.",
    projects: [
      {
        name: "E-commerce Store",
        description: "Full-featured online store accepting crypto payments with automatic USDC conversion.",
        image: "/ecommerce-crypto-checkout.jpg",
        tags: ["Retail", "Multi-chain", "USDC"],
        stats: { users: "100K+", volume: "$5M+", transactions: "500K+" },
        links: { website: "https://cryptostore.example.com", github: "https://github.com/cryptostore" },
      },
      {
        name: "Subscription Service",
        description: "Recurring crypto payments for SaaS and subscription-based businesses.",
        image: "/subscription-payment-platform.jpg",
        tags: ["SaaS", "Recurring", "Automation"],
        stats: { users: "25K+", volume: "$3M+", transactions: "200K+" },
        links: { website: "https://subscriptions.example.com" },
      } 
    ],
  },
  staking: {
    title: "Gaming & Staking",
    icon: TrendingUp,
    description:
      "Earn passive yield on idle USDC balances through secure, on-chain staking strategies with flexible access.",
    projects: [],
  },
//   governance: {
//     title: "Governance",
//     icon: Vote,
//     description: "Participate in decentralized decision-making with on-chain voting and transparent proposal systems.",
//     projects: [],
//   },
//   partnerships: {
//     title: "Partnerships",
//     icon: Handshake,
//     description: "Collaborate with other protocols and businesses through secure, programmable payment infrastructure.",
//     projects: [],
//   },
}

export default function UseCasesPage() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedCategory(expandedCategory === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      {/* <header className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-50 bg-black/80">
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
      </header> */}

      <div className="absolute top-5 left-4 z-20">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">← Back to Home</Link>
              </Button>
            </div>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Built for{" "}
              <span className="bg-gradient-to-r from-amber-400 to-yellow-600 bg-clip-text text-transparent">
                Every Use Case
              </span>
            </h1>
            <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
              Discover how Nummus powers payments, staking, governance, and more across the crypto ecosystem.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Use Cases with Projects */}
      <section className="py-5 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="space-y-8">
            {Object.entries(categoryData).map(([id, category], index) => {
              const Icon = category.icon
              const isExpanded = expandedCategory === id

              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="relative"
                >
                  <button
                    onClick={() => toggleExpand(id)}
                    className="w-full text-left group rounded-2xl border transition-all duration-300 border-white/10 bg-white/5 hover:border-amber-400/50 hover:bg-gradient-to-br hover:from-amber-400/5 hover:to-yellow-600/5"
                  >
                    <div className="flex items-center justify-between p-8">
                      <div className="flex items-center space-x-6">
                        <div className="w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-300 bg-white/10 group-hover:bg-gradient-to-br group-hover:from-amber-400 group-hover:to-yellow-600 group-hover:scale-110">
                          <Icon className="w-8 h-8 text-white group-hover:text-black transition-colors" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold">{category.title}</h3>
                          <p className="text-gray-400 text-sm mt-1">{category.description}</p>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-6 h-6 text-gray-400 group-hover:text-amber-400 transition-all duration-300 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-6 px-4">
                          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {category.projects.map((project, projectIndex) => (
                              <motion.div
                                key={project.name}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: projectIndex * 0.1 }}
                                className="group/card"
                              >
                                <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-amber-400/50 hover:bg-gradient-to-br hover:from-amber-400/5 hover:to-yellow-600/5 transition-all duration-300">
                                  {/* Project Image */}
                                  <div className="relative h-48 overflow-hidden">
                                    <img
                                      src={project.image || "/placeholder.svg"}
                                      alt={project.name}
                                      className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                  </div>

                                  {/* Project Content */}
                                  <div className="p-6 space-y-4">
                                    <div>
                                      <h4 className="text-xl font-bold mb-2">{project.name}</h4>
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
                                        <p className="text-sm font-semibold text-amber-400">
                                          {project.stats.transactions}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Links */}
                                    <div className="flex gap-2 pt-2">
                                      {project.links.website && (
                                        <Button
                                          size="sm"
                                          className="flex-1 bg-gradient-to-r from-amber-400 to-yellow-600 text-black hover:from-amber-500 hover:to-yellow-700"
                                          asChild
                                        >
                                          <a href={project.links.website} target="_blank" rel="noopener noreferrer">
                                            <Globe className="w-4 h-4 mr-2" />
                                            Visit Site
                                          </a>
                                        </Button>
                                      )}
                                      {project.links.github && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-white/20 hover:bg-white/10 bg-transparent"
                                          asChild
                                        >
                                          <a href={project.links.github} target="_blank" rel="noopener noreferrer">
                                            <Github className="w-4 h-4" />
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Join thousands of businesses and developers building the future of payments with Nummus.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black hover:from-amber-500 hover:to-yellow-700 px-8"
                asChild
              >
                <Link href="/signup">
                  Get Started
                  <ChevronDown className="ml-2 w-5 h-5" />
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

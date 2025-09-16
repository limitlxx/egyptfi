"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mail,
  ArrowRight,
  CheckCircle,
  Star,
  Users,
  TrendingUp,
} from "lucide-react";

export const PreFooter: React.FC = () => {
  const stats = [
    {
      icon: <Users className="h-6 w-6" />,
      value: "10,000+",
      label: "Active Merchants",
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      value: "$2.5M+",
      label: "Transaction Volume",
    },
    {
      icon: <Star className="h-6 w-6" />,
      value: "4.9/5",
      label: "Merchant Rating",
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="container mx-auto max-w-7xl">
        {/* Newsletter Section */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Stay Updated with EgyptFi
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Get the latest updates on new features, security enhancements, and
            exclusive offers for our merchant community.
          </p>

          <Card className="max-w-md mx-auto bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1"
                />
                <Button className="bg-primary hover:bg-primary/90">
                  <Mail className="h-4 w-4 mr-2" />
                  Subscribe
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                We respect your privacy. Unsubscribe at any time.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <div className="text-primary">{stat.icon}</div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-2">
                {stat.value}
              </div>
              <div className="text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <CheckCircle className="h-4 w-4" />
            Ready to get started?
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Join Thousands of Merchants Already Using EgyptFi
          </h3>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Start accepting crypto payments today and unlock new revenue streams
            for your business.
          </p>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-lg px-8 py-4"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PreFooter;

'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, BarChart3, Shield, Zap, Globe, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { redirect } from 'next/navigation'

export default function WelcomePage() {
  const { isAuthenticated } = useAuth()

  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">TradePro</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Professional Trading
            <br />
            <span className="text-primary">Made Simple</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Advanced trading platform with real-time market data, sophisticated analytics, 
            and institutional-grade execution capabilities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">Start Trading Now</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Why Choose TradePro?</h2>
          <p className="text-muted-foreground text-lg">
            Built for traders who demand performance, reliability, and advanced features.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <BarChart3 className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Advanced Charts</CardTitle>
              <CardDescription>
                Professional-grade charting with 100+ technical indicators and drawing tools.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                Ultra-low latency execution with real-time market data and instant order fills.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Bank-Level Security</CardTitle>
              <CardDescription>
                Your funds and data are protected with institutional-grade security measures.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Globe className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Global Markets</CardTitle>
              <CardDescription>
                Trade Forex, CFDs, Commodities, and Indices from a single platform.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-12 w-12 text-primary mb-2" />
              <CardTitle>MAM/PAMM</CardTitle>
              <CardDescription>
                Advanced money management solutions for professional traders and managers.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Analytics</CardTitle>
              <CardDescription>
                Comprehensive trading analytics and performance tracking tools.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Ready to Start Trading?</CardTitle>
            <CardDescription className="text-lg">
              Join thousands of traders who trust TradePro for their trading needs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/register">Create Free Account</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Already have an account?</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Demo accounts available • No commitment required
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 TradePro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
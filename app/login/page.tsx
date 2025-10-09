'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff, TrendingUp, Sun, Moon } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "next-themes"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  
  const { login, isAuthenticated, user } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // Get redirect URL from URL params (simpler approach)
  const getRedirectUrl = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('redirect') || '/'
    }
    return '/'
  }

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectUrl = getRedirectUrl()
      
      console.log('Login useEffect - User:', user)
      console.log('Login useEffect - User role:', user.role)
      console.log('Login useEffect - Is admin?', user.role?.toLowerCase() === 'admin')
      console.log('Login useEffect - Redirect URL:', redirectUrl)
      
      // If user is admin, redirect to admin dashboard
      if (user.role?.toLowerCase() === 'admin') {
        console.log('Redirecting admin to:', redirectUrl.startsWith('/admin') ? redirectUrl : '/admin')
        if (redirectUrl.startsWith('/admin')) {
          router.replace(redirectUrl)
        } else {
          router.replace('/admin')
        }
      } else {
        console.log('Redirecting regular user to:', redirectUrl)
        router.replace(redirectUrl)
      }
    }
  }, [isAuthenticated, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await login(email, password)
      
      // Check if user is admin and redirect accordingly
      const redirectUrl = getRedirectUrl()
      const userRole = response?.user?.role
      
      console.log('Login handleSubmit - Full response:', response)
      console.log('Login handleSubmit - User:', response?.user)
      console.log('Login handleSubmit - User role:', userRole)
      console.log('Login handleSubmit - Redirect URL:', redirectUrl)
      console.log('Login handleSubmit - Is admin?', userRole?.toLowerCase() === 'admin')
      
      // If user is admin, always redirect to admin dashboard (unless specifically requesting another admin page)
      if (userRole?.toLowerCase() === 'admin') {
        console.log('Login handleSubmit - Redirecting admin to:', redirectUrl.startsWith('/admin') ? redirectUrl : '/admin')
        if (redirectUrl.startsWith('/admin')) {
          router.replace(redirectUrl)
        } else {
          router.replace('/admin')
        }
      } else {
        console.log('Login handleSubmit - Redirecting regular user to:', redirectUrl)
        // For non-admin users, redirect to the requested URL or dashboard
        router.replace(redirectUrl)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed. Please try again."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const demoCredentials = [
    { label: "Demo User", email: "john.anderson@example.com", password: "password123" },
    { label: "Admin User", email: "admin@tradingplatform.com", password: "admin123" }
  ]

  const fillDemoCredentials = (email: string, password: string) => {
    setEmail(email)
    setPassword(password)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Theme Toggle */}
        <div className="fixed top-4 right-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hover:bg-accent/50"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>

        {/* Logo/Brand */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary p-3 rounded-xl shadow-lg">
              <TrendingUp className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">TradePro</h1>
          <p className="text-muted-foreground mt-2">Sign in to your trading account</p>
        </div>

        {/* Login Form */}
        <Card className="bg-card/50 backdrop-blur-sm border shadow-xl">
          <CardHeader>
            <CardTitle className="text-foreground text-center">Welcome Back</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="bg-background border-border text-foreground placeholder-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="bg-background border-border text-foreground placeholder-muted-foreground pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="text-sm font-medium text-foreground mb-3">Demo Accounts</h3>
              <div className="space-y-2">
                {demoCredentials.map((demo, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                    <div>
                      <div className="text-foreground font-medium">{demo.label}</div>
                      <div className="text-muted-foreground">{demo.email}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fillDemoCredentials(demo.email, demo.password)}
                      className="text-primary hover:text-primary/80"
                    >
                      Use
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Register Link */}
            <div className="mt-6 text-center">
              <p className="text-muted-foreground text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-primary hover:text-primary/80 underline">
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          © 2025 TradePro. Advanced Trading Platform.
        </p>
      </div>
    </div>
  )
}
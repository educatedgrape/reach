"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { signInWithMagicLink, signInWithGoogle } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const [isMagicLoading, startMagic] = useTransition()
  const [isGoogleLoading, startGoogle] = useTransition()

  function handleMagicLink(formData: FormData) {
    startMagic(async () => {
      const result = await signInWithMagicLink(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.success)
    })
  }

  function handleGoogle() {
    startGoogle(async () => {
      const result = await signInWithGoogle()
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome to OutreachHQ</CardTitle>
        <CardDescription>Sign in to run thoughtful campaigns for your charity community.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          action={handleMagicLink}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@charity.org"
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={isMagicLoading}>
            {isMagicLoading ? "Sending link..." : "Send Magic Link"}
          </Button>
        </form>
        <form action={handleGoogle}>
          <Button className="w-full" type="submit" variant="outline" disabled={isGoogleLoading}>
            {isGoogleLoading ? "Redirecting..." : "Continue with Google"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

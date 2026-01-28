'use client'

import { useActionState } from 'react'
import { forgotPassword } from './actions'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from 'next/link'
import Image from 'next/image'

const initialState = {
    error: '',
    message: '',
}

export function ForgotPasswordForm() {
    const [state, formAction, isPending] = useActionState(forgotPassword, initialState)

    return (
        <Card className="w-full max-w-md mx-auto border-slate-200 shadow-sm">
            <CardHeader className="space-y-1 text-center">
                <div className="flex justify-center mb-6">
                    <Image
                        src="/images/LSL_Text_Logo.png"
                        alt="Left Side Logos"
                        width={200}
                        height={64}
                        className="h-16 w-auto object-contain"
                        priority
                    />
                </div>
                <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
                <CardDescription>
                    Enter your email and we&apos;ll send you a link to reset your password.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {state?.message ? (
                    <div className="p-4 bg-green-50 text-green-700 rounded-md text-sm border border-green-200">
                        {state.message}
                    </div>
                ) : (
                    <form action={formAction} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="m@example.com" required />
                        </div>
                        {state?.error && (
                            <div className="text-sm text-red-500 font-medium">{state.error}</div>
                        )}
                        <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={isPending}>
                            {isPending ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                    </form>
                )}
            </CardContent>
            <CardFooter className="justify-center">
                <Link href="/login" className="text-sm font-semibold text-slate-900 hover:underline">
                    Back to Sign in
                </Link>
            </CardFooter>
        </Card>
    )
}

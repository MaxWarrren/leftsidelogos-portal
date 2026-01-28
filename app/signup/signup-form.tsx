'use client'

import { useActionState } from 'react'
import { signup } from './actions'
import { loginWithGoogle } from '../login/actions'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import Link from 'next/link'
import Image from 'next/image'

const initialState = {
    error: '',
    message: '',
}

export function SignupForm() {
    const [state, formAction, isPending] = useActionState(signup, initialState)

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
                <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
                <CardDescription>
                    Enter your details to get started
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
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input id="fullName" name="fullName" placeholder="John Doe" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="m@example.com" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" name="password" type="password" required minLength={6} />
                        </div>
                        {state?.error && (
                            <div className="text-sm text-red-500 font-medium">{state.error}</div>
                        )}
                        <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={isPending}>
                            {isPending ? 'Creating account...' : 'Create account'}
                        </Button>
                    </form>
                )}

                {!state?.message && (
                    <>
                        <div className="flex items-center gap-4">
                            <Separator className="flex-1" />
                            <span className="text-slate-500 text-xs uppercase font-medium">Or continue with</span>
                            <Separator className="flex-1" />
                        </div>

                        <form action={loginWithGoogle}>
                            <Button variant="outline" className="w-full" type="submit">
                                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                </svg>
                                Google
                            </Button>
                        </form>
                    </>
                )}
            </CardContent>
            <CardFooter className="justify-center">
                <div className="text-sm text-slate-500">
                    Already have an account?{" "}
                    <Link href="/login" className="font-semibold text-slate-900 hover:underline">
                        Sign in
                    </Link>
                </div>
            </CardFooter>
        </Card>
    )
}

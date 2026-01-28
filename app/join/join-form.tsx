'use client'

import { useActionState } from 'react'
import { joinOrganization } from './actions'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Image from 'next/image'

const initialState = {
    error: '',
}

export function JoinForm() {
    const [state, formAction, isPending] = useActionState(joinOrganization, initialState)

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
                <CardTitle className="text-2xl font-bold">Join your organization</CardTitle>
                <CardDescription>
                    Enter the access code provided by your administrator.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <form action={formAction} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="code">Access Code</Label>
                        <Input id="code" name="code" placeholder="XXXX-0000" required className="text-center text-lg tracking-widest uppercase" />
                    </div>
                    {state?.error && (
                        <div className="text-sm text-red-500 font-medium">{state.error}</div>
                    )}
                    <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={isPending}>
                        {isPending ? 'Joining...' : 'Join Organization'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}

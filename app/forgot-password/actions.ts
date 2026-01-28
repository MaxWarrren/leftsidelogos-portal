'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'

export async function forgotPassword(prevState: any, formData: FormData) {
    const supabase = await createClient()
    const origin = (await headers()).get('origin')
    const email = formData.get('email') as string

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
        return { error: 'Could not send reset email. Please try again.', message: '' }
    }

    return { message: 'Check your email for a password reset link.', error: '' }
}

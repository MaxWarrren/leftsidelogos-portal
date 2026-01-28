'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function joinOrganization(prevState: any, formData: FormData) {
    const supabase = await createClient()
    const code = formData.get('code') as string

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Find organization by code
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('access_code', code)
        .single()

    if (orgError || !org) {
        return { error: 'Invalid access code. Please try again.' }
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', org.id)
        .eq('user_id', user.id)
        .single()

    if (existingMember) {
        return { error: 'You are already a member of this organization.' }
    }

    // Add to organization_members
    const { error: joinError } = await supabase
        .from('organization_members')
        .insert({
            organization_id: org.id,
            user_id: user.id,
            role: 'member'
        })

    if (joinError) {
        return { error: 'Failed to join organization. Please try again.' }
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

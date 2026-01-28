'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function setActiveOrganization(orgId: string) {
    const cookieStore = await cookies()
    cookieStore.set('active_org_id', orgId, { path: '/' })
    redirect('/')
}

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = await createClient()
        const { error, data } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data?.user) {
            // Check if there is a matching lead for this user's email
            // and update it if found to mark them as a fully registered user
            const { error: updateError } = await supabase
                .from('leads')
                .update({
                    contact_type: 'user',
                    converted_profile_id: data.user.id
                })
                .eq('email', data.user.email)
                .is('converted_profile_id', null); // Only update if not already converted

            if (updateError) {
                console.error("Failed to link new user to lead:", updateError);
            }

            // Auto-create organization if provided during signup
            const orgName = data.user.user_metadata?.organization_name;
            if (orgName) {
                // Check if user already has an org membership
                const { data: existingMembership } = await supabase
                    .from('organization_members')
                    .select('id')
                    .eq('user_id', data.user.id)
                    .limit(1)
                    .single();

                if (!existingMembership) {
                    const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                    const { data: newOrg, error: orgError } = await supabase
                        .from('organizations')
                        .insert({ name: orgName, access_code: accessCode })
                        .select('id')
                        .single();

                    if (newOrg && !orgError) {
                        await supabase
                            .from('organization_members')
                            .insert({
                                organization_id: newOrg.id,
                                user_id: data.user.id,
                                role: 'owner',
                            });
                    }
                }
            }

            const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
            const isLocalEnv = process.env.NODE_ENV === 'development'

            // If user has an org, go to dashboard; otherwise go to join page
            const { data: membership } = await supabase
                .from('organization_members')
                .select('id')
                .eq('user_id', data.user.id)
                .limit(1)
                .single();

            const redirectPath = membership ? next : '/join';

            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${redirectPath}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`)
            } else {
                return NextResponse.redirect(`${origin}${redirectPath}`)
            }
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}

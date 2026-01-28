const { createClient } = require('@supabase/supabase-js')

// Hardcoding keys from context for script execution
const url = 'https://fijepyoxxfjjyynuwdmr.supabase.co'
// Using the anon key found in get_publishable_keys (JWT one) to be safe for Auth
// But previously I saw .env.local used `sb_publishable_`
// I'll try the `sb_publishable_` one first as it's in the environment.
const key = 'sb_publishable_OH_hiVFqnohp5gUD12T2YQ_qYJPOTvT'
const supabase = createClient(url, key)

async function seed() {
    const users = [
        { email: 'maxwell@axiondigital.io', password: 'admin123', name: 'Maxwell Warren' },
        { email: 'leftsidelogos@gmail.com', password: 'admin123', name: 'Brad Gunn' }
    ]

    for (const u of users) {
        console.log(`Creating ${u.email}...`)
        // try sign up
        const { data, error } = await supabase.auth.signUp({
            email: u.email,
            password: u.password,
            options: {
                data: { full_name: u.name }
            }
        })

        if (error) {
            console.error(`Error creating ${u.email}:`, error.message)
        } else {
            console.log(`Success ${u.email}:`, data.session ? 'Session active' : 'Check email for confirmation')

            // If session active (unlikely if confirm is on), we can set org
            if (data.user) {
                // We can't set organization_id here easily without user context or service role.
                // But the user can do it via /join UI using '1234'
                console.log('User created. Please log in and use code 1234 to join Admin org.')
            }
        }
    }
}

seed()

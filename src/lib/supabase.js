// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'
import { browser } from '$app/environment'
import { Capacitor } from '@capacitor/core'

const isNativeApp = browser && Capacitor.isNativePlatform()

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    flowType: isNativeApp ? 'pkce' : 'implicit',
    detectSessionInUrl: !isNativeApp,
  },
})

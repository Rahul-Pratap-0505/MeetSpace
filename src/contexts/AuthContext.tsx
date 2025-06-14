import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Utility to robustly cleanup Supabase auth client state
const cleanupAuthState = () => {
  try {
    // Remove all supabase and sb- keys from localStorage and sessionStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key)
      }
    })
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key)
      }
    })
  } catch (e) {
    // noop
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session) => {
        console.log('Auth event:', event)
        setUser(session?.user ?? null)
        setLoading(false)
        
        if (event === "SIGNED_UP" as AuthChangeEvent && session?.user) {
          // Profile creation is handled by the database trigger
          console.log('User signed up, profile will be created automatically')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    cleanupAuthState() // Clean state before signing in
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      throw error
    }
  }

  const signUp = async (email: string, password: string, username: string) => {
    cleanupAuthState() // Clean state before signing up
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    })
    if (error) {
      throw error
    }
  }

  const signInWithGoogle = async () => {
    cleanupAuthState() // Clean state before signing in
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/chat`,
      },
    })
    if (error) {
      throw error
    }
  }

  const signOut = async () => {
    cleanupAuthState()
    // Try global sign out, but ignore errors (in case no session)
    try {
      await supabase.auth.signOut({ scope: 'global' } as any)
    } catch (e) {}
    cleanupAuthState()
    // Redirect to /auth for a clean state
    window.location.href = '/auth'
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

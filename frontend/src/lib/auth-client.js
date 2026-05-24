import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export const useSession = () => {
  const [data, setData] = useState(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (mounted) {
          if (error) throw error;
          setData(session ? { user: session.user, session } : null);
        }
      } catch (err) {
        if (mounted) setError(err);
      } finally {
        if (mounted) setIsPending(false);
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setData(session ? { user: session.user, session } : null);
        setIsPending(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { data, isPending, error };
};

export const signIn = {
  email: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // mimic better-auth error format if necessary, but usually just returning error is fine
      return { data: null, error: { message: error.message } };
    }
    return { data, error: null };
  }
};

export const signUp = {
  email: async ({ email, password, name }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) {
      return { data: null, error: { message: error.message } };
    }
    return { data, error: null };
  }
};

export const signOut = async () => {
  return supabase.auth.signOut();
};

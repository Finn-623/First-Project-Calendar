/**
 * Authentication Service
 * Handles user login, logout, and session management
 */

import { supabase } from '../lib/supabaseClient';

export const authService = {
  /**
   * Sign in with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{user, session, error}>}
   */
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, session: null, error };
      }

      return { user: data.user, session: data.session, error: null };
    } catch (err) {
      return { user: null, session: null, error: err };
    }
  },

  /**
   * Sign out current user
   * @returns {Promise<{error}>}
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      return { error };
    } catch (err) {
      return { error: err };
    }
  },

  /**
   * Get current session
   * @returns {Promise<{session, error}>}
   */
  async getSession() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      return { session, error };
    } catch (err) {
      return { session: null, error: err };
    }
  },

  /**
   * Get current user
   * @returns {Promise<{user, error}>}
   */
  async getUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      return { user, error };
    } catch (err) {
      return { user: null, error: err };
    }
  },

  /**
   * Listen to auth state changes
   * @param {Function} callback - Called with {event, session}
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

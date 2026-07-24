/**
 * Authentication Service
 * Handles user login, logout, and session management
 */

import { supabase } from '../lib/supabaseClient';

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

function normalizeUsername(username) {
  if (typeof username !== 'string') return null;
  const normalized = username.trim().toLowerCase();
  if (!USERNAME_REGEX.test(normalized)) return null;
  return normalized;
}

export const authService = {
  /**
   * Sign in with username and password via Edge Function
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{user, session, error}>}
   */
  async signInWithUsername(username, password) {
    if (!supabase) {
      return { user: null, session: null, error: new Error('Supabase 尚未配置') };
    }

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return {
        user: null,
        session: null,
        error: new Error('用户名只能包含3至30位小写字母、数字或下划线。'),
      };
    }

    if (typeof password !== 'string' || password.length === 0) {
      return {
        user: null,
        session: null,
        error: new Error('用户名或密码错误。'),
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('username-login', {
        body: {
          username: normalizedUsername,
          password,
        },
      });

      if (error) {
        return { user: null, session: null, error: new Error('用户名或密码错误。') };
      }

      const accessToken = data?.access_token;
      const refreshToken = data?.refresh_token;
      if (!accessToken || !refreshToken) {
        return { user: null, session: null, error: new Error('用户名或密码错误。') };
      }

      const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (setSessionError) {
        return { user: null, session: null, error: setSessionError };
      }

      const session = sessionData?.session;
      const user = sessionData?.user || session?.user;

      if (!user || !session) {
        return { user: null, session: null, error: new Error('登录失败，请稍后重试') };
      }

      return { user, session, error: null };
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

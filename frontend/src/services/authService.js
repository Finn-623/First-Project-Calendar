/**
 * Authentication Service
 * Handles user login, logout, and session management
 */

import { supabase } from '../lib/supabaseClient';

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;
const INVALID_CREDENTIALS_MESSAGE = '用户名或密码错误';
const SERVICE_UNAVAILABLE_MESSAGE = '登录服务暂时不可用，请稍后重试';
const USERNAME_FORMAT_MESSAGE = '用户名只能包含3至30位小写字母、数字或下划线。';
const USERNAME_LOGIN_PATH = '/functions/v1/username-login';

function isTransientErrorMessage(message) {
  if (!message) return false;
  return /(network|fetch|timeout|session|token|temporar|lock|jwt|auth)/i.test(String(message));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
        error: new Error(USERNAME_FORMAT_MESSAGE),
      };
    }

    if (typeof password !== 'string' || password.length === 0) {
      return {
        user: null,
        session: null,
        error: new Error(INVALID_CREDENTIALS_MESSAGE),
      };
    }

    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        return { user: null, session: null, error: new Error(SERVICE_UNAVAILABLE_MESSAGE) };
      }

      const endpoint = `${supabaseUrl}${USERNAME_LOGIN_PATH}`;
      const requestBody = JSON.stringify({
        username: normalizedUsername,
        password,
      });
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
        },
        body: requestBody,
      };

      let response;
      try {
        response = await fetch(endpoint, requestOptions);
      } catch {
        await wait(150);
        response = await fetch(endpoint, requestOptions);
      }

      if (response.status >= 500) {
        await wait(150);
        response = await fetch(endpoint, requestOptions);
      }

      if (!response.ok) {
        if (response.status === 400) {
          return { user: null, session: null, error: new Error(USERNAME_FORMAT_MESSAGE) };
        }
        if (response.status === 401) {
          return { user: null, session: null, error: new Error(INVALID_CREDENTIALS_MESSAGE) };
        }
        return { user: null, session: null, error: new Error(SERVICE_UNAVAILABLE_MESSAGE) };
      }

      let data;
      try {
        data = await response.json();
      } catch {
        return { user: null, session: null, error: new Error(SERVICE_UNAVAILABLE_MESSAGE) };
      }

      const accessToken = data?.access_token;
      const refreshToken = data?.refresh_token;
      if (!accessToken || !refreshToken) {
        return { user: null, session: null, error: new Error(SERVICE_UNAVAILABLE_MESSAGE) };
      }

      let { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (setSessionError && isTransientErrorMessage(setSessionError.message)) {
        await wait(150);
        const retryResult = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        sessionData = retryResult.data;
        setSessionError = retryResult.error;
      }

      if (setSessionError) {
        return { user: null, session: null, error: setSessionError };
      }

      const session = sessionData?.session;
      const user = sessionData?.user || session?.user;

      if (!user || !session) {
        return { user: null, session: null, error: new Error(SERVICE_UNAVAILABLE_MESSAGE) };
      }

      return { user, session, error: null };
    } catch (err) {
      return { user: null, session: null, error: new Error(SERVICE_UNAVAILABLE_MESSAGE) };
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

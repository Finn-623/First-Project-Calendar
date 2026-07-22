// Module-level state to prevent duplicate auth initialization and listeners
let authSubscription = null;
let authInitPromise = null;
let currentUserId = null;

/**
 * Initialize Supabase auth globally (module-level singleton)
 * Called only once from App component
 */
export async function initializeAuthGlobally() {
  // Return existing promise if already initializing
  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = (async () => {
    try {
      // Don't register listener here - let App.js handle it
      // This function only validates the client is ready
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) console.warn('Auth initialization check:', error);
      return { success: !error };
    } catch (err) {
      console.error('Auth initialization failed:', err);
      return { success: false };
    }
  })();

  return authInitPromise;
}

/**
 * Register global auth state listener
 * Must be called only once from App component
 */
export function registerAuthListener(onStateChange) {
  if (authSubscription) {
    // Already registered
    return authSubscription;
  }

  const { data: subscription } = window.supabaseClient.auth.onAuthStateChange(
    (event, session) => {
      // Update current user ID for profile loading
      if (session?.user?.id) {
        currentUserId = session.user.id;
      } else {
        currentUserId = null;
      }

      onStateChange(event, session);
    }
  );

  authSubscription = subscription;
  return subscription;
}

/**
 * Cleanup auth listener
 */
export function unregisterAuthListener() {
  if (authSubscription) {
    authSubscription.unsubscribe?.();
    authSubscription = null;
  }
  authInitPromise = null;
}

/**
 * Get current user ID (safe for profile loading)
 */
export function getCurrentUserId() {
  return currentUserId;
}

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INVALID_CREDENTIALS_MESSAGE = "用户名或密码错误";
const INVALID_USERNAME_MESSAGE = "用户名格式不正确";
const SERVICE_UNAVAILABLE_MESSAGE = "登录服务暂时不可用，请稍后重试";
const MAX_CONTENT_LENGTH_BYTES = 8 * 1024;
const MAX_USERNAME_INPUT_LENGTH = 128;
const MAX_PASSWORD_INPUT_LENGTH = 1024;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeUsername(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new Error("INVALID_USERNAME_FORMAT");
  }

  if (raw.length > MAX_USERNAME_INPUT_LENGTH) {
    throw new Error("INVALID_USERNAME_FORMAT");
  }

  const normalized = raw.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(normalized)) {
    throw new Error("INVALID_USERNAME_FORMAT");
  }

  return normalized;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "no-store",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      error: "仅支持 POST 请求",
    });
  }

  try {

  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH_BYTES) {
      return jsonResponse(400, {
        success: false,
        error: "请求体过大",
      });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("FUNCTION_CONFIG_MISSING");
    return jsonResponse(500, {
      success: false,
      error: SERVICE_UNAVAILABLE_MESSAGE,
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, {
      success: false,
      error: "请求格式错误",
    });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse(400, {
      success: false,
      error: "请求格式错误",
    });
  }

  const body = payload as { username?: unknown; password?: unknown };

  let normalizedUsername: string;
  try {
    normalizedUsername = normalizeUsername(body.username);
  } catch {
    return jsonResponse(400, {
      success: false,
      error: INVALID_USERNAME_MESSAGE,
    });
  }

  if (typeof body.password !== "string") {
    return jsonResponse(401, {
      success: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    });
  }

  const password = body.password;
  if (password.length === 0 || password.length > MAX_PASSWORD_INPUT_LENGTH) {
    return jsonResponse(401, {
      success: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (profileError) {
    console.error("PROFILE_QUERY_FAILED");
    return jsonResponse(500, {
      success: false,
      error: SERVICE_UNAVAILABLE_MESSAGE,
    });
  }

  if (!profile?.id) {
    console.info("USERNAME_PROFILE_NOT_FOUND");
    return jsonResponse(401, {
      success: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    });
  }

  const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(profile.id);

  if (authUserError) {
    if (authUserError.status === 404 || authUserError.code === "user_not_found") {
      console.info("AUTH_USER_NOT_FOUND");
      return jsonResponse(401, {
        success: false,
        error: INVALID_CREDENTIALS_MESSAGE,
      });
    }

    console.error("AUTH_ADMIN_API_FAILED");
    return jsonResponse(500, {
      success: false,
      error: SERVICE_UNAVAILABLE_MESSAGE,
    });
  }

  if (!authUserData?.user) {
    console.info("AUTH_USER_NOT_FOUND");
    return jsonResponse(401, {
      success: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    });
  }

  const existingEmail = authUserData.user.email;
  if (!existingEmail) {
    console.info("AUTH_USER_EMAIL_MISSING");
    return jsonResponse(401, {
      success: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    });
  }

  const loginClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: signInData, error: signInError } = await loginClient.auth.signInWithPassword({
    email: existingEmail,
    password,
  });

  const accessToken = signInData?.session?.access_token;
  const refreshToken = signInData?.session?.refresh_token;
  const expiresAt = signInData?.session?.expires_at;

  if (signInError || !accessToken || !refreshToken || !expiresAt) {
    console.info("PASSWORD_SIGNIN_FAILED");
    return jsonResponse(401, {
      success: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    });
  }

  console.info("LOGIN_SUCCESS");

  return jsonResponse(200, {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  });
  } catch {
    console.error("FUNCTION_INTERNAL_ERROR");
    return jsonResponse(500, {
      success: false,
      error: SERVICE_UNAVAILABLE_MESSAGE,
    });
  }
});

# First Project Calendar

## Username + Password Login (Supabase Existing Users)

This branch supports login with `username + original password` for existing Supabase Auth users.
It does **not** create new Auth users, does **not** change existing emails, and does **not** change existing passwords.

### 1. Run Database Migrations

Apply migrations in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/003_food_library_visibility.sql`
3. `supabase/migrations/004_username_login.sql`

The `004` migration adds/ensures:

1. `public.profiles.username TEXT` (nullable during transition)
2. `public.profiles.display_name TEXT` (if missing)
3. username format check: `^[a-z0-9_]{3,30}$`
4. partial unique index for non-null usernames
5. server-side username normalization trigger (trim + lowercase)
6. own-profile-only RLS policies on `public.profiles`

### 2. One-Time Username Setup for Existing Users

For each existing account, manually bind username/display_name to the existing user UID.

1. Open Supabase Dashboard -> Authentication -> Users
2. Find the existing user account
3. Copy the user UID
4. Run SQL in SQL Editor:

```sql
INSERT INTO public.profiles (
	id,
	username,
	display_name
)
VALUES (
	'替换成现有账户UID',
	'finn',
	'Finn'
)
ON CONFLICT (id) DO UPDATE
SET
	username = EXCLUDED.username,
	display_name = EXCLUDED.display_name,
	updated_at = now();
```

Notes:

1. Do not modify existing `auth.users.email`.
2. Do not modify existing passwords.
3. Do not create new users if an account already exists.

### 3. Configure Frontend Environment Variables

In `frontend/.env.local`:

```env
REACT_APP_SUPABASE_URL=YOUR_SUPABASE_URL
REACT_APP_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Frontend must only use publishable/anon key. Never use service role key in frontend.

### 4. Configure Edge Function Secrets

Set these secrets for functions runtime:

1. `SUPABASE_URL`
2. `SUPABASE_SERVICE_ROLE_KEY`
3. `SUPABASE_ANON_KEY`

Do not commit real secret values into Git.

### 5. Deploy Edge Function

Function path:

1. `supabase/functions/username-login/index.ts`

Deploy command example:

```bash
supabase functions deploy username-login
```

Function config in `supabase/config.toml`:

```toml
[functions.username-login]
verify_jwt = false
```

Why `verify_jwt = false` is required:

1. This function is called before user login.
2. Requiring JWT would create a login loop (must login to call login function).

### 6. Username Login Flow

1. Client submits `username + password`.
2. Client invokes `username-login` function.
3. Function normalizes username (`trim + lowercase`) and validates format.
4. Function queries `public.profiles` by username to get user id.
5. Function uses `auth.admin.getUserById(id)` to fetch existing Auth email.
6. Function signs in with existing email + original password.
7. Function returns only `{ access_token, refresh_token, expires_at }`.
8. Client calls `supabase.auth.setSession(...)`.

The function does not return email.

### 7. View Function Logs

You can inspect function runtime logs using Supabase dashboard or CLI tools.
Keep logs sanitized: never print passwords, tokens, service role key, or user email.

### 8. Security Checklist

Never commit or expose:

1. service role key
2. secret key
3. publishable key real values
4. user password
5. user email
6. real user UID

Allowed to commit:

1. variable names
2. placeholder examples
3. deployment steps

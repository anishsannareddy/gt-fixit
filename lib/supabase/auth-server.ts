import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client that reads/writes the signed-in user's session cookies.
 * Use it ONLY for auth (who is signed in, sign in, sign out). All data access still goes
 * through db() in ./server.ts, which uses the service-role key on the server.
 */
export async function authClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components can't set cookies. That's fine: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}

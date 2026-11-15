import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_META } from "@/lib/constants";
import type { Role } from "@/lib/types";

// Next 16 renamed middleware.ts → proxy.ts. Runs on the server before every page request:
//  1. refreshes the Supabase session cookie when it's close to expiring (standard @supabase/ssr pattern)
//  2. routes by role BEFORE anything renders, with a real HTTP redirect:
//       signed out on a protected page → landing page
//       wrong role for a page          → that user's home
//       signed in on / or /login       → that user's home
// Every page and server action ALSO checks with requireUser (lib/auth.ts), so this is the fast
// first gate, not the only one.

/** Which roles may open each protected section. Request detail pages decide access per request. */
const SECTIONS: [RegExp, Role[]][] = [
  [/^\/(report|my-requests|issues)(\/|$)/, ["reporter"]],
  [/^\/tech(\/|$)/, ["technician", "admin"]],
  [/^\/admin(\/|$)/, ["admin"]],
  [/^\/requests(\/|$)/, ["reporter", "technician", "admin"]],
];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const path = request.nextUrl.pathname;
  const section = SECTIONS.find(([re]) => re.test(path));
  const isEntry = path === "/" || path === "/login";
  if (!section && !isEntry) return response; // public page: just keep the session fresh

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  const redirectTo = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url));
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!userId) return section ? redirectTo("/") : response;

  // Role lives in our users table (never in the session token), read with the server-only key.
  const { data: profile } = await createClient(url, serviceKey, { auth: { persistSession: false } })
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = profile?.role as Role | undefined;
  if (!role) return response; // signed in but no profile yet: let the page create it (lib/auth.ts loadProfile)

  const home = ROLE_META[role].home;
  if (isEntry) return redirectTo(home);
  if (section && !section[1].includes(role)) return redirectTo(home);
  return response;
}

export const config = {
  // Everything except static files and images
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|gif)$).*)"],
};

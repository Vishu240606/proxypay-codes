import { supabase } from "@/integrations/supabase/client";

/**
 * Wraps a useServerFn-returned function to automatically include the user's
 * auth bearer token on every call (required by requireSupabaseAuth middleware).
 */
export function useAuthedFn<TFn extends (opts: { data: any; headers?: Record<string, string> }) => Promise<any>>(
  fn: TFn,
): TFn {
  return (async (opts: { data: any; headers?: Record<string, string> }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return fn({
      ...opts,
      headers: {
        ...(opts?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }) as TFn;
}

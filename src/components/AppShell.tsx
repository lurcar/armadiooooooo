import { Link, Outlet } from "@tanstack/react-router";
import { Shirt, Layers, MessageCircle, User, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Guardaroba", icon: Shirt },
  { to: "/crea-outfit", label: "Outfit", icon: Plus },
  { to: "/outfit", label: "Salvati", icon: Layers },
  { to: "/chat", label: "Chat AI", icon: MessageCircle },
] as const;

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { id: u.user.id, email: u.user.email ?? "", display_name: data?.display_name ?? u.user.email?.split("@")[0] ?? "" };
    },
  });
}

export function AppShell() {
  const { data: profile } = useProfile();
  const initial = (profile?.display_name || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:h-16">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">
            Armadio<span className="text-primary">.</span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-full bg-secondary p-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: true }}
                className="rounded-full px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "bg-primary !text-primary-foreground shadow-sm" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Link
            to="/profilo"
            aria-label="Profilo e impostazioni"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground md:h-10 md:w-10 md:text-base"
          >
            {initial}
          </Link>
        </div>
      </header>

      <main className="mx-auto min-w-0 max-w-6xl overflow-x-hidden px-4 py-4 md:py-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-lg md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
          {[...NAV, { to: "/profilo", label: "Profilo", icon: User } as const].map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: true }}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold text-muted-foreground"
              activeProps={{ className: "!text-primary" }}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          ))}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}

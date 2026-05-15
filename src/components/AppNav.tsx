import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  LogOut,
  LayoutDashboard,
  History,
  UserCircle,
  Clock,
  Check,
  ShieldAlert,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import {
  getNotifications,
  markAllRead,
  subscribeNotifications,
  type AppNotification,
} from "@/lib/notifications";
import { toast } from "sonner";

const SESSION_DURATION_SECONDS = 30 * 60; // 30 minutes display countdown

function fmtClock(total: number) {
  const m = Math.max(0, Math.floor(total / 60));
  const s = Math.max(0, total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/history", label: "History", icon: History },
  { to: "/profile", label: "Profile", icon: UserCircle },
] as const;

export function AppNav({ userName }: { userName?: string }) {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_DURATION_SECONDS);

  // Notifications
  useEffect(() => {
    const refresh = () => setNotifs(getNotifications());
    refresh();
    return subscribeNotifications(refresh);
  }, []);

  // Session countdown — anchored to login time stored at sign-in
  useEffect(() => {
    const startKey = "proxipay.sessionStart";
    let start = Number(localStorage.getItem(startKey) || 0);
    if (!start) {
      start = Date.now();
      localStorage.setItem(startKey, String(start));
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setSecondsLeft(Math.max(0, SESSION_DURATION_SECONDS - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const unread = notifs.filter((n) => !n.read).length;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("proxipay.sessionStart");
    toast.success("Logged out");
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-glass-border bg-background/50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeProps={{
                  className:
                    "bg-primary/10 text-primary border border-primary/30",
                }}
                inactiveProps={{
                  className:
                    "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent",
                }}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Session timer */}
          <div
            className={`hidden items-center gap-1.5 rounded-xl border border-glass-border bg-glass px-2.5 py-1.5 text-[11px] font-mono sm:inline-flex ${
              secondsLeft < 60 ? "text-destructive" : "text-foreground"
            }`}
            title="Session expires in"
          >
            <Clock className="h-3 w-3" />
            {fmtClock(secondsLeft)}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setOpen((v) => !v);
                if (!open && unread) markAllRead();
              }}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-glass-border bg-glass transition-colors hover:bg-white/10"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </button>
            {open && (
              <NotificationPanel
                notifs={notifs}
                onClose={() => setOpen(false)}
              />
            )}
          </div>

          {userName && (
            <span className="hidden text-xs text-muted-foreground lg:inline">
              {userName}
            </span>
          )}

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-glass-border bg-glass px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile nav row */}
      <nav className="flex items-center justify-around border-t border-glass-border px-2 py-1.5 md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="inline-flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function NotificationPanel({
  notifs,
  onClose,
}: {
  notifs: AppNotification[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 z-50 mt-2 w-[20rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-glass-border bg-card/95 shadow-2xl backdrop-blur-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {notifs.length > 0 && (
            <button
              onClick={() => {
                markAllRead();
              }}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Check className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              You're all caught up. No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-glass-border">
              {notifs.map((n) => (
                <NotificationRow key={n.id} n={n} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function NotificationRow({ n }: { n: AppNotification }) {
  const Icon =
    n.kind === "payment"
      ? CreditCard
      : n.kind === "security"
        ? ShieldAlert
        : ShieldCheck;
  const tone =
    n.kind === "security"
      ? "text-destructive bg-destructive/10"
      : n.kind === "payment"
        ? "text-primary bg-primary/10"
        : "text-amber-400 bg-amber-400/10";
  return (
    <li className="flex gap-3 px-4 py-3 transition-colors hover:bg-white/5">
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${tone}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">{n.title}</p>
          {!n.read && (
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{n.message}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/70">
          {new Date(n.createdAt).toLocaleString()}
        </p>
      </div>
    </li>
  );
}

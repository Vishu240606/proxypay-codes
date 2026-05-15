import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-elevated max-w-md rounded-2xl p-10 text-center">
        <h1 className="text-7xl font-bold gradient-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-xl btn-glow px-5 py-3 text-sm font-semibold"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ProxiPay — Secure Peer-to-Peer Payment System" },
      {
        name: "description",
        content:
          "Send and receive money instantly with one-time verification codes. ProxiPay Mini keeps every transfer secure.",
      },
      { name: "author", content: "ProxiPay" },
      { property: "og:title", content: "ProxiPay — Secure Peer-to-Peer Payment System" },
      { property: "og:description", content: "A secure fintech web application for session-based peer-to-peer payments with authentication, transaction history, and biometric verification flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "ProxiPay — Secure Peer-to-Peer Payment System" },
      { name: "description", content: "A secure fintech web application for session-based peer-to-peer payments with authentication, transaction history, and biometric verification flow." },
      { name: "twitter:description", content: "A secure fintech web application for session-based peer-to-peer payments with authentication, transaction history, and biometric verification flow." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/08b9d2f9-36d7-48e9-8584-8f0f84065142/id-preview-d4eaca6f--31e93a49-4f66-40dd-aeb6-94da37138ffd.lovable.app-1778856270252.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/08b9d2f9-36d7-48e9-8584-8f0f84065142/id-preview-d4eaca6f--31e93a49-4f66-40dd-aeb6-94da37138ffd.lovable.app-1778856270252.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast: "glass-elevated !bg-card/80 !text-foreground !border-glass-border",
          },
        }}
      />
    </>
  );
}

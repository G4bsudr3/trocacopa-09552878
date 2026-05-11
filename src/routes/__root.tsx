import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display text-primary text-glow">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Essa figurinha ainda não está no álbum.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow-primary"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-full gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0A0A0F" },
      { title: "TrocaAI — Troque figurinhas da Copa 2026" },
      { name: "description", content: "Plataforma comunitária para colecionadores trocarem figurinhas da Copa do Mundo 2026 com pessoas próximas." },
      { property: "og:title", content: "TrocaAI — Troque figurinhas da Copa 2026" },
      { property: "og:description", content: "Plataforma comunitária para colecionadores trocarem figurinhas da Copa do Mundo 2026 com pessoas próximas." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "TrocaAI — Troque figurinhas da Copa 2026" },
      { name: "twitter:description", content: "Plataforma comunitária para colecionadores trocarem figurinhas da Copa do Mundo 2026 com pessoas próximas." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d2ed9750-6232-41f0-901a-168c7897155e/id-preview-462f6ef5--13ab35bb-d389-423a-88d5-dac0a3864064.lovable.app-1778380852344.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d2ed9750-6232-41f0-901a-168c7897155e/id-preview-462f6ef5--13ab35bb-d389-423a-88d5-dac0a3864064.lovable.app-1778380852344.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster theme="dark" position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}

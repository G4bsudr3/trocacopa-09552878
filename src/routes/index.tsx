import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/use-theme";
import logoBranca from "@/assets/logo-branca.png";
import logoPreta from "@/assets/logo-preta.png";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const { theme } = useTheme();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <img
          src={theme === "dark" ? logoBranca : logoPreta}
          alt="TrocaAI"
          className="h-20 object-contain animate-pulse"
        />
      </div>
    );
  }
  return <Navigate to={session ? "/home" : "/login"} />;
}

import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="font-display text-4xl text-primary text-glow animate-pulse">⚽ TrocaCopa</div>
      </div>
    );
  }
  return <Navigate to={session ? "/home" : "/login"} />;
}

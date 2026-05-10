import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, ScanLine, MapPin, User, Repeat2, ArrowLeftRight, Bell, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useUnreadNotifications } from "@/lib/use-unread-notifications";

const items = [
  { to: "/home", icon: Home, label: "Início" },
  { to: "/album", icon: BookOpen, label: "Álbum" },
  { to: "/scan", icon: ScanLine, label: "Escanear" },
  { to: "/near", icon: MapPin, label: "Perto" },
  { to: "/duplicates", icon: Repeat2, label: "Repetidas" },
  { to: "/trades", icon: ArrowLeftRight, label: "Trocas" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { profile } = useAuth();
  const { total } = useUnreadNotifications();
  const isActive = (to: string) => path === to || path.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/home" className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-2xl">⚽</span>
          {!collapsed && (
            <span className="font-display text-lg tracking-wide text-primary text-glow">TROCACOPA</span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ to, icon: Icon, label }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild isActive={isActive(to)} tooltip={label}>
                    <Link to={to}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/notifications")} tooltip="Notificações">
                  <Link to="/notifications" search={{ filter: "all" }}>
                    <Bell />
                    <span>Notificações</span>
                    {total > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {total > 99 ? "99+" : total}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/profile")} tooltip="Perfil">
              <Link to="/profile">
                <User />
                <span className="truncate">{profile?.full_name ?? "Perfil"}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Configurações">
              <Link to="/settings">
                <Settings />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

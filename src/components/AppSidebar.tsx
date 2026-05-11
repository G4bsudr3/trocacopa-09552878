import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, BookOpen, ScanLine, MapPin, User, Repeat2, ArrowLeftRight, Bell, Settings, LogOut, Sun, Moon, ChevronUp } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useUnreadNotifications } from "@/lib/use-unread-notifications";
import { useTheme } from "@/lib/use-theme";
import { toast } from "sonner";

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
  const { profile, signOut } = useAuth();
  const { total } = useUnreadNotifications();
  const { theme, toggle: toggleTheme } = useTheme();
  const nav = useNavigate();
  const isActive = (to: string) => path === to || path.startsWith(to + "/");

  const name = profile?.full_name ?? "Perfil";
  const initial = name[0]?.toUpperCase() ?? "?";

  const handleSignOut = async () => {
    await signOut();
    toast.success("Até logo!");
    nav({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/home" className="flex items-center px-2 py-1.5">
          <img
            src={theme === "dark" ? "/logo-branca.png" : "/logo-preta.png"}
            alt="TrocaCopa"
            className={collapsed ? "h-5 object-contain" : "h-7 object-contain"}
          />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip={name} className="h-auto py-2">
                  <div className="w-6 h-6 rounded-md gradient-primary flex items-center justify-center font-bold text-primary-foreground text-xs shrink-0 overflow-hidden">
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      : initial}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold truncate leading-tight">{name}</p>
                    <p className="text-[10px] text-muted-foreground truncate leading-tight">{profile?.city ?? ""}</p>
                  </div>
                  <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate">
                  {name}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                    <User size={14} /> Meu perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings size={14} /> Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme} className="flex items-center gap-2 cursor-pointer">
                  {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                  Tema {theme === "dark" ? "claro" : "escuro"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut size={14} /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

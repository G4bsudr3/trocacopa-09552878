## Objetivo

Tornar a navegação responsiva: sidebar lateral em telas ≥ md (768px), barra inferior só em mobile, sem cobrir conteúdo nem sino de notificações.

## 1. Componente novo `src/components/AppSidebar.tsx`

- Usa `Sidebar` do shadcn (`collapsible="icon"`) com `useRouterState` para destacar a rota ativa.
- Itens: Início, Álbum, Escanear, Perto, Repetidas, Trocas, Perfil.
- Item "Notificações" com badge de não-lidos (`useUnreadNotifications`).
- No rodapé do sidebar: avatar + nome do usuário linkando ao perfil.
- Logo "⚽ TROCACOPA" no header do sidebar.

## 2. Reestruturar `src/routes/_app.tsx`

Layout responsivo:

```tsx
<SidebarProvider>
  <div className="min-h-screen flex w-full">
    <AppSidebar />               {/* hidden no mobile via Sidebar interno */}
    <div className="flex-1 flex flex-col min-w-0">
      <header className="hidden md:flex h-12 items-center justify-between border-b px-3">
        <SidebarTrigger />
        <NotificationBell inline />
      </header>
      <main className="flex-1 pb-24 md:pb-6">
        <Outlet />
      </main>
      <BottomNav />              {/* só md:hidden */}
    </div>
  </div>
</SidebarProvider>
```

Mudanças concretas:
- `BottomNav`: adicionar `md:hidden` no `<nav>` para sumir no desktop.
- `NotificationBell`: aceitar prop `inline`. Quando inline, renderiza sem `fixed`. Quando flutuante (mobile), continua `fixed top-3 right-3`, mas com `md:hidden` para não conflitar com o header desktop.
- `<main>`: padding inferior 24 só em mobile (`pb-24 md:pb-6`).

## 3. Corrigir overlaps que ainda existem em mobile

- `src/routes/_app.duplicates.tsx`: o CTA fixo `bottom-24` fica colado na bottom nav. Trocar por `bottom-28 md:static md:bottom-auto md:mt-6` para o CTA virar inline em desktop e ter folga em mobile. Também ajustar `pb-32` → `pb-36 md:pb-10`.
- `src/routes/_app.album.tsx`: o header tem botões "Repetidas" e "Resetar" no canto superior direito que ficam embaixo do sino flutuante em mobile. Garantir que o sino só aparece em rotas onde não conflita: deslocar header do álbum com `pr-14 md:pr-0` para reservar espaço do sino em mobile.
- Conferir telas com top-right denso (`/profile` já tem ícone settings) — aplicar mesmo `pr-14 md:pr-0` quando necessário.

## 4. Detalhes shadcn Tailwind 4

- Usar `w-[var(--sidebar-width)]` (não `w-[--sidebar-width]`) caso seja preciso customizar — mas vamos manter o componente padrão sem overrides, evitando o bug.
- Sidebar `collapsible="icon"` para que ao colapsar fique uma faixa fina com ícones (não some).
- `SidebarTrigger` no header desktop, sempre visível.

## Arquivos afetados

- Criar `src/components/AppSidebar.tsx`.
- Editar `src/routes/_app.tsx` (layout, BottomNav, NotificationBell).
- Editar `src/routes/_app.duplicates.tsx` (CTA + padding).
- Editar `src/routes/_app.album.tsx` (header padding em mobile).

## Sem mudanças

- Rotas, dados, schema, design tokens.

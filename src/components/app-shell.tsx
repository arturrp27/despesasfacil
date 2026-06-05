import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ArrowLeftRight, Tags, CreditCard, BarChart3, LogOut, Wallet, Plus, Menu, PanelLeftClose, PanelLeftOpen, Users, Moon, Sun } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { TransactionDialog } from "@/components/transaction-dialog";
import { useTheme } from "@/hooks/use-theme";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { to: "/categories", label: "Categorias", icon: Tags },
  { to: "/cards", label: "Cartões", icon: CreditCard },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
  { to: "/users", label: "Usuários", icon: Users },
];

function NavList({ onClick }: { onClick?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {nav.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onLogout, onNavigate }: { onLogout: () => void; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-sm leading-tight">Controle</div>
          <div className="text-xs text-sidebar-foreground/60">Financeiro</div>
        </div>
      </div>
      <NavList onClick={onNavigate} />
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} title={theme === "dark" ? "Modo claro" : "Modo escuro"}>
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className={`hidden md:flex shrink-0 border-r border-sidebar-border transition-all duration-200 ${sidebarOpen ? "w-64" : "w-0 border-r-0 overflow-hidden"}`}>
        <SidebarContent onLogout={logout} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/80 backdrop-blur px-4 py-3 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarContent onLogout={logout} onNavigate={() => setSheetOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="font-semibold">Controle</span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? "Ocultar menu" : "Mostrar menu"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </Button>
            <h1 className="text-lg font-semibold capitalize">
              {nav.find((n) => n.to === pathname)?.label ?? ""}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={() => setTxOpen(true)} className="rounded-full" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova
            </Button>
          </div>
        </header>


        <main className="flex-1 p-4 md:p-8">{children}</main>




        {/* Floating action mobile */}
        <Button
          onClick={() => setTxOpen(true)}
          className="md:hidden fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-40"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>


        <TransactionDialog open={txOpen} onOpenChange={setTxOpen} />
      </div>
    </div>
  );
}

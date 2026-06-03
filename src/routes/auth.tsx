import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Wallet, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Controle Financeiro" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-accent">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Controle Financeiro</h1>
          <p className="text-sm text-muted-foreground">Suas finanças pessoais, no controle.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Acesse sua conta</CardTitle>
            <CardDescription>Use seu e-mail e senha para entrar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Entrar
              </Button>
              <p className="text-xs text-muted-foreground text-center pt-2">
                Cadastro público desativado. Solicite acesso ao administrador.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

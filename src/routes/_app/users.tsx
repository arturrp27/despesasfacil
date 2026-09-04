import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createAppUser, listAppUsers, updateAppUserPassword } from "@/lib/admin-users.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "Usuários — Controle Financeiro" }] }),
  component: UsersPage,
});

type UserRow = {
  id: string;
  email?: string | null;
  display_name: string | null;
  created_at: string;
};

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAppUsers);
  const createFn = useServerFn(createAppUser);
  const passFn = useServerFn(updateAppUserPassword);

  const usersQ = useQuery({ queryKey: ["app-users"], queryFn: () => listFn({}) });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [pwdUser, setPwdUser] = useState<UserRow | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Senha mínima de 6 caracteres.");
    setBusy(true);
    try {
      await createFn({ data: { email, password, display_name: name || email.split("@")[0] } });
      toast.success("Usuário criado.");
      setEmail("");
      setName("");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!pwdUser) return;
    if (newPwd.length < 6) return toast.error("Senha mínima de 6 caracteres.");
    setPwdBusy(true);
    try {
      await passFn({ data: { user_id: pwdUser.id, password: newPwd } });
      toast.success("Senha alterada.");
      setPwdUser(null);
      setNewPwd("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Novo usuário
          </CardTitle>
          <CardDescription>
            O cadastro público está desativado. Crie novos acessos por aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar usuário
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {usersQ.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {(usersQ.data ?? []).map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 border-b last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{u.display_name ?? u.email}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDateBR(u.created_at)}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPwdUser(u as UserRow);
                  setNewPwd("");
                }}
              >
                <KeyRound className="h-4 w-4 mr-1" /> Alterar senha
              </Button>
            </div>
          ))}
          {usersQ.data && usersQ.data.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum usuário ainda.</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!pwdUser}
        onOpenChange={(v) => {
          if (!v) {
            setPwdUser(null);
            setNewPwd("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>{pwdUser?.display_name ?? pwdUser?.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newpwd">Nova senha</Label>
              <Input
                id="newpwd"
                type="password"
                minLength={6}
                required
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPwdUser(null);
                  setNewPwd("");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pwdBusy}>
                {pwdBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

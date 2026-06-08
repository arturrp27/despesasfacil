import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Configurações — Controle Financeiro" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const [days, setDays] = useState(3);
  const [notifyDue, setNotifyDue] = useState(true);
  const [notifyNew, setNotifyNew] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["user_settings"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", u.user.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setDays(data.days_before_due);
      setNotifyDue(data.notify_due);
      setNotifyNew(data.notify_new_transactions);
    }
  }, [data]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") {
      new Notification("Notificações ativadas", { body: "Você receberá alertas de vencimentos." });
      toast.success("Notificações ativadas no dispositivo.");
    } else {
      toast.error("Permissão negada. Ative nas configurações do navegador.");
    }
  };

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("user_settings").upsert({
      user_id: u.user.id,
      days_before_due: days,
      notify_due: notifyDue,
      notify_new_transactions: notifyNew,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas.");
    qc.invalidateQueries({ queryKey: ["user_settings"] });
  };

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Configurações</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Notificações</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Dias de antecedência para alertar vencimento</Label>
            <Input
              type="number" min={0} max={60}
              value={days}
              onChange={(e) => setDays(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
            />
            <p className="text-xs text-muted-foreground">
              Despesas pendentes que vencem em até {days} dia(s) aparecerão como alerta.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Avisar sobre vencimentos próximos</Label>
              <p className="text-xs text-muted-foreground">Inclui também despesas vencidas.</p>
            </div>
            <Switch checked={notifyDue} onCheckedChange={setNotifyDue} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Avisar sobre novas transações geradas</Label>
              <p className="text-xs text-muted-foreground">Recorrências e parcelamentos criados automaticamente.</p>
            </div>
            <Switch checked={notifyNew} onCheckedChange={setNotifyNew} />
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              {permission === "granted" ? <Bell className="h-4 w-4 text-success" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
              <span className="text-sm font-medium">Notificações no dispositivo</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {permission === "granted" && "Ativadas. Você verá pop-ups do navegador."}
              {permission === "denied" && "Bloqueadas. Habilite manualmente nas configurações do navegador/celular."}
              {permission === "default" && "Conceda permissão para receber alertas no celular mesmo com o app em segundo plano."}
              {permission === "unsupported" && "Este navegador não suporta notificações."}
            </p>
            {permission === "default" && (
              <Button size="sm" variant="outline" onClick={requestPermission}>Ativar notificações</Button>
            )}
          </div>

          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

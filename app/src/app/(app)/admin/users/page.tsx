"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { t, LOCALE_COOKIE, getLocaleFromCookie, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Send, UserPlus, CheckCircle, Clock, Trash2 } from "lucide-react";

interface AppUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
}

export default function AdminUsersPage() {
  const [locale] = useState<Locale>(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
      return getLocaleFromCookie(match?.[1]);
    }
    return "fr";
  });

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "commercial">("commercial");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function fetchUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setMessage(null);

    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password: password || undefined, role }),
    });

    if (res.ok) {
      toast.success(t("admin.invite_success", locale));
      setMessage({ type: "success", text: t("admin.invite_success", locale) });
      setEmail("");
      setPassword("");
      setRole("commercial");
      fetchUsers();
    } else {
      const data = await res.json();
      const errorMsg = data.error || t("admin.invite_error", locale);
      toast.error(errorMsg);
      setMessage({ type: "error", text: errorMsg });
    }
    setSending(false);
  }

  async function handleDelete(userId: string) {
    if (!confirm(t("admin.delete_confirm", locale))) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("admin.delete_success", locale));
      fetchUsers();
    } catch {
      toast.error(t("admin.delete_error", locale));
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(locale === "es" ? "es-ES" : "fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-condensed text-2xl font-bold tracking-tight">
          {t("admin.title", locale)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.subtitle", locale)}</p>
      </div>

      {/* Invite form */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t("admin.invite", locale)}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder={t("admin.invite_placeholder", locale)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 max-w-xs"
              />
              <Input
                type="password"
                placeholder={t("admin.password_placeholder", locale)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="h-10 max-w-xs"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "commercial")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="commercial">{t("admin.role_commercial", locale)}</option>
                <option value="admin">{t("admin.role_admin", locale)}</option>
              </select>
              <Button type="submit" disabled={sending} className="h-10 gap-2 font-semibold">
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("admin.sending", locale)}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    {t("admin.create", locale)}
                  </>
                )}
              </Button>
            </div>
          </form>
          {message && (
            <div
              className={`mt-3 rounded-md border px-3 py-2 text-sm ${
                message.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
              }`}
            >
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users list */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("admin.no_users", locale)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium uppercase tracking-wider">
                    {t("admin.email", locale)}
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider">
                    {t("admin.status", locale)}
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider">
                    {t("admin.created_at", locale)}
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider">
                    {t("admin.last_sign_in", locale)}
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      {u.confirmed ? (
                        <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600">
                          <CheckCircle className="h-3 w-3" />
                          {t("admin.confirmed", locale)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-600">
                          <Clock className="h-3 w-3" />
                          {t("admin.pending", locale)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(u.lastSignInAt)}</TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title={t("admin.delete_confirm", locale)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

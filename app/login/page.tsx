"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError("Usuario o contraseña inválidos.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm p-6"
      >
        <h1 className="text-lg font-semibold text-slate-900 mb-1">Acceso DVV</h1>
        <p className="text-sm text-slate-500 mb-5">Ingresa con tu usuario del equipo.</p>

        <label className="text-xs uppercase tracking-wider text-slate-500">Email</label>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mt-1 mb-4 bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:border-monex focus:ring-1 focus:ring-monex"
          placeholder="apellido@dvv.monex.mx"
          required
        />

        <label className="text-xs uppercase tracking-wider text-slate-500">Contraseña</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mt-1 mb-5 bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 focus:outline-none focus:border-monex focus:ring-1 focus:ring-monex"
          required
        />

        {error && <div className="text-sm text-rose-600 mb-3">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-monex text-white font-semibold rounded px-4 py-2 hover:bg-monexHover transition disabled:opacity-60"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}

import { PmmgShield } from "../components/Brand";

export function SetupView() {
  return (
    <main className="grid min-h-screen place-items-center bg-pm-cream p-6">
      <div className="pm-panel max-w-lg p-8">
        <PmmgShield className="h-20 w-auto" />
        <h1 className="pm-title mt-4">Configuração pendente</h1>
        <p className="pm-subtitle">Variáveis do Supabase não encontradas</p>
        <p className="mt-4 text-sm text-pm-ink">Cadastre no projeto da Vercel (Settings → Environment Variables) ou num arquivo <code>.env</code> local:</p>
        <pre className="mt-3 rounded-sm bg-pm-black p-4 text-xs text-pm-gold-light">VITE_SUPABASE_URL=https://xxxx.supabase.co{"\n"}VITE_SUPABASE_ANON_KEY=...</pre>
        <p className="mt-3 text-sm text-pm-muted">Depois, faça um novo deploy.</p>
      </div>
    </main>
  );
}

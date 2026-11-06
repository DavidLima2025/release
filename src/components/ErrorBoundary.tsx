import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";

type Props = { children: React.ReactNode; title?: string; resetKey?: unknown };
type State = { error: Error | null };

/** Captura erros de renderização de uma tela sem derrubar o sistema inteiro. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Erro na tela:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pm-panel border-status-late/40 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 shrink-0 text-status-late" />
          <div>
            <h2 className="pm-heading text-status-late">{this.props.title || "Falha ao carregar esta tela"}</h2>
            <p className="mt-1 text-sm text-pm-muted">Um dado inesperado impediu a exibição. As outras telas continuam funcionando.</p>
            <pre className="mt-3 max-h-32 overflow-auto rounded-sm bg-pm-sand p-3 text-xs text-pm-ink">{String(this.state.error?.message || this.state.error)}</pre>
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={() => this.setState({ error: null })}>Tentar novamente</Button>
              <Button onClick={() => window.location.reload()}>Recarregar sistema</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

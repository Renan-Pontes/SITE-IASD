import { Component, type ReactNode } from "react";

/**
 * Captura erros de renderização para não deixar a tela em branco.
 * Mostra uma mensagem amigável com botão de recarregar.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { erro: boolean }
> {
  state = { erro: false };

  static getDerivedStateFromError() {
    return { erro: true };
  }

  componentDidCatch(erro: unknown) {
    // eslint-disable-next-line no-console
    console.error("Erro capturado pelo ErrorBoundary:", erro);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-5xl">😕</div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Algo deu errado nesta tela
          </h1>
          <p className="max-w-sm text-slate-500">
            Tente recarregar a página. Se continuar, avise a equipe.
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="btn-primary"
          >
            Voltar ao início
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

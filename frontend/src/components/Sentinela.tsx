import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

/**
 * Marcador invisível que dispara `onVisivel` ao entrar na viewport
 * (carregar mais itens). Mostra um spinner enquanto `carregando`.
 */
export function Sentinela({
  onVisivel,
  ativo,
  carregando,
}: {
  onVisivel: () => void;
  ativo: boolean;
  carregando?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ativo) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && onVisivel(),
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ativo, onVisivel]);

  return (
    <div ref={ref} className="flex justify-center py-4">
      {carregando && <Loader2 className="animate-spin text-marca-500" size={24} />}
    </div>
  );
}

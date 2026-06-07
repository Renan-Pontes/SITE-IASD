import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Paginated } from "../lib/types";

/**
 * Carrega uma lista paginada do DRF página a página (scroll infinito).
 * `buildPath(page)` deve montar a URL com o número da página.
 * `deps` reinicia a lista quando muda (ex.: filtros/busca).
 */
export function useInfinite<T>(buildPath: (page: number) => string, deps: any[] = []) {
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const pageRef = useRef(1);
  const lockRef = useRef(false);
  const buildRef = useRef(buildPath);
  buildRef.current = buildPath;

  const fetchPage = useCallback(async (p: number, replace: boolean) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setLoading(true);
    try {
      const data = await api.get<Paginated<T>>(buildRef.current(p));
      setItems((prev) => (replace ? data.results : [...prev, ...data.results]));
      setHasMore(!!data.next);
      setTotal(data.count);
      pageRef.current = p + 1;
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
      lockRef.current = false;
    }
  }, []);

  // Reinicia e carrega a 1ª página quando os deps mudam.
  useEffect(() => {
    pageRef.current = 1;
    setItems([]);
    setHasMore(true);
    fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const carregarMais = useCallback(() => {
    if (!lockRef.current && hasMore) fetchPage(pageRef.current, false);
  }, [hasMore, fetchPage]);

  const recarregar = useCallback(() => {
    pageRef.current = 1;
    fetchPage(1, true);
  }, [fetchPage]);

  return { items, setItems, hasMore, loading, total, carregarMais, recarregar };
}

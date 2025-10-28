// app/hooks/useDolar.ts
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useDolar() {
  const { data, error, isLoading, mutate } = useSWR("/api/dolar", fetcher, {
    refreshInterval: 60_000, // consulta cada 60s
    dedupingInterval: 30_000
  });
  console.log(data)
  return {
    data: data?.data, // por nuestro shape { ok, data }
    error,
    isLoading,
    refresh: mutate
  };
}

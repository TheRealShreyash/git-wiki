import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const keys = {
  repos: ["repos"] as const,
  repo: (id: string) => ["repos", id] as const,
  status: (id: string) => ["repos", id, "status"] as const,
  file: (id: string, path: string) => ["repos", id, "file", path] as const,
  messages: (id: string) => ["repos", id, "messages"] as const,
  suggestions: ["suggestions"] as const,
};

export function useRepos() {
  return useQuery({
    queryKey: keys.repos,
    queryFn: api.listRepos,
    refetchInterval: 4000,
  });
}

export function useRepo(id: string) {
  return useQuery({
    queryKey: keys.repo(id),
    queryFn: () => api.getRepo(id),
    enabled: Boolean(id),
  });
}

/** Polls the indexing job once per second until the pipeline reports ready. */
export function useIndexStatus(id: string, live = true) {
  return useQuery({
    queryKey: keys.status(id),
    queryFn: () => api.getStatus(id),
    enabled: Boolean(id),
    refetchInterval: live ? 1000 : false,
  });
}

export function useIndexRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.indexRepo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.repos }),
  });
}

export function useRepoFile(id: string, path: string | null) {
  return useQuery({
    queryKey: keys.file(id, path ?? ""),
    queryFn: () => api.getFile(id, path as string),
    enabled: Boolean(id && path),
    staleTime: 5 * 60_000,
  });
}

export function useMessages(id: string) {
  return useQuery({
    queryKey: keys.messages(id),
    queryFn: () => api.getMessages(id),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

export function useSuggestions() {
  return useQuery({
    queryKey: keys.suggestions,
    queryFn: api.getSuggestions,
    staleTime: Infinity,
  });
}

export function useClearMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.clearMessages(id),
    onSuccess: (_data, { id }) =>
      queryClient.invalidateQueries({ queryKey: keys.messages(id) }),
  });
}

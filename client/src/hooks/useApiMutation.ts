import { useMutation, useQueryClient, UseMutationOptions } from "@tanstack/react-query";

export function useApiMutation<TData = unknown, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  invalidate: readonly (readonly unknown[])[],
  options?: Omit<UseMutationOptions<TData, Error, TVars>, "mutationFn">
) {
  const qc = useQueryClient();

  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: (data, variables, context) => {
      invalidate.forEach((key) => {
        qc.invalidateQueries({ queryKey: [...key] });
      });
      options?.onSuccess?.(data, variables, context);
    },
    onError: options?.onError,
    onSettled: options?.onSettled,
  });
}

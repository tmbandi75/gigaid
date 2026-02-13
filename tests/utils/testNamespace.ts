let _namespace: string | null = null;

export function getTestNamespace(): string {
  if (_namespace) return _namespace;
  _namespace =
    process.env.TEST_RUN_ID ||
    `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[TestNamespace] Active namespace: ${_namespace}`);
  return _namespace;
}

export function ns(value: string): string {
  return `${getTestNamespace()}_${value}`;
}

export function resetNamespace(): void {
  _namespace = null;
}

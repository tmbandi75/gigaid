export const HARD_GATED_CAPABILITIES: Record<string, boolean> = {
  deposit_enforcement: false
};

export type HardGatedCapability = keyof typeof HARD_GATED_CAPABILITIES;

export function isHardGated(capability: string): boolean {
  return HARD_GATED_CAPABILITIES[capability] === true;
}

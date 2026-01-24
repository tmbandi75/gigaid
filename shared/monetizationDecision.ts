export type MonetizationDecision = {
  ready: boolean;
  ratio: number;
};

export function evaluateProPlusReadiness({
  softIntercepts,
  pricingInterest
}: {
  softIntercepts: number;
  pricingInterest: number;
}): MonetizationDecision {
  if (softIntercepts === 0) {
    return { ready: false, ratio: 0 };
  }

  const ratio = pricingInterest / softIntercepts;

  return {
    ready: ratio >= 0.25,
    ratio
  };
}

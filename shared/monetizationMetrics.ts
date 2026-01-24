export interface MonetizationReadiness {
  ready: boolean;
  ratio: number;
}

export function isProPlusReady({
  softIntercepts,
  pricingViews
}: {
  softIntercepts: number;
  pricingViews: number;
}): MonetizationReadiness | false {
  if (softIntercepts === 0) {
    return false;
  }

  const ratio = pricingViews / softIntercepts;

  return {
    ready: ratio >= 0.25,
    ratio
  };
}

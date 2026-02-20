export function getLocationPermissionMessage(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "Please enable location access in your browser settings for automatic detection.";
  }

  const ua = navigator.userAgent.toLowerCase();

  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isMobile = isIOS || isAndroid;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-ignore
    window.navigator.standalone === true;

  if (isMobile && isStandalone) {
    return "Please enable location access for GigAid in your phone\u2019s settings to allow automatic detection.";
  }

  if (isMobile) {
    return "Please allow location access in your browser when prompted to enable automatic detection.";
  }

  return "Please enable location access in your browser settings for automatic detection.";
}

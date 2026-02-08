import { useEffect, useRef } from "react";
import { captureUtmParams, sendAttributionToServer } from "@/lib/utmCapture";

export function useUtmCapture() {
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    captureUtmParams();
  }, []);
}

export function useAttributionSync() {
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;

    const timer = setTimeout(() => {
      sendAttributionToServer();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);
}

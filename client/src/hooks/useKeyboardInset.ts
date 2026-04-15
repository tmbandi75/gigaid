import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

type RemoveFn = () => Promise<void>;

/**
 * Returns bottom inset when the keyboard (or dock) shrinks the visible area.
 * Native: Capacitor Keyboard events. Web: visualViewport. Fallback if Keyboard fails.
 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      setInset(0);
      return;
    }

    let disposed = false;

    const attachVisualViewport = (): RemoveFn => {
      const vv = window.visualViewport;
      if (!vv) {
        return async () => {};
      }
      const update = () => {
        if (disposed) return;
        setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
      };
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      update();
      return async () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      };
    };

    if (!Capacitor.isNativePlatform()) {
      let removeVv: RemoveFn | undefined;
      removeVv = attachVisualViewport();
      return () => {
        disposed = true;
        setInset(0);
        void removeVv?.();
      };
    }

    const registration = (async (): Promise<RemoveFn> => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        const handles: { remove: () => Promise<void> }[] = [];

        handles.push(
          await Keyboard.addListener("keyboardWillShow", (e) => {
            if (!disposed) setInset(e.keyboardHeight);
          })
        );
        handles.push(
          await Keyboard.addListener("keyboardDidShow", (e) => {
            if (!disposed) setInset((h) => Math.max(h, e.keyboardHeight));
          })
        );
        handles.push(
          await Keyboard.addListener("keyboardWillHide", () => {
            if (!disposed) setInset(0);
          })
        );
        handles.push(
          await Keyboard.addListener("keyboardDidHide", () => {
            if (!disposed) setInset(0);
          })
        );

        return async () => {
          await Promise.all(handles.map((h) => h.remove().catch(() => undefined)));
        };
      } catch {
        return attachVisualViewport();
      }
    })();

    return () => {
      disposed = true;
      setInset(0);
      void registration.then((remove) => remove());
    };
  }, [active]);

  return inset;
}

"use client";

import { useEffect } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Bancard?: any;
  }
}

export function BancardCheckout({ processId, jsUrl }: { processId: string; jsUrl: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = jsUrl;
    script.async = true;
    script.onload = () => {
      try {
        window.Bancard?.Checkout?.createForm("bancard-container", processId);
      } catch {
        /* ignore */
      }
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
      try {
        window.Bancard?.Checkout?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, [processId, jsUrl]);

  return <div id="bancard-container" style={{ minHeight: 420 }} />;
}

import { useEffect } from "react";
import { useObserve } from "@/lib/easObserve";

export function useObserveInteractive() {
  const { markInteractive } = useObserve();

  useEffect(() => {
    markInteractive();
  }, [markInteractive]);
}
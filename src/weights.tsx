import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_WEIGHTS, type FactorKey, type Weights } from "./engine/handicap";

const STORAGE_KEY = "hp-weights";

function loadWeights(): Weights {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WEIGHTS };
    const parsed = JSON.parse(raw) as Partial<Weights>;
    const next = { ...DEFAULT_WEIGHTS };
    for (const key of Object.keys(DEFAULT_WEIGHTS) as FactorKey[]) {
      const value = parsed[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 40) {
        next[key] = value;
      }
    }
    return next;
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

interface WeightsApi {
  weights: Weights;
  setWeight: (key: FactorKey, value: number) => void;
  reset: () => void;
}

const WeightsContext = createContext<WeightsApi | null>(null);

export function WeightsProvider({ children }: { children: ReactNode }) {
  const [weights, setWeights] = useState<Weights>(loadWeights);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  }, [weights]);

  const api: WeightsApi = {
    weights,
    setWeight: (key, value) => setWeights((current) => ({ ...current, [key]: value })),
    reset: () => setWeights({ ...DEFAULT_WEIGHTS }),
  };

  return <WeightsContext.Provider value={api}>{children}</WeightsContext.Provider>;
}

export function useWeights(): WeightsApi {
  const value = useContext(WeightsContext);
  if (!value) throw new Error("Weights are only available inside the app.");
  return value;
}

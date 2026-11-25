import { useEffect, useState } from "react";
import { isoDateIn } from "@shared/time";

/** Today's date in America/Recife; updates after midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => isoDateIn(new Date()));
  useEffect(() => {
    const id = setInterval(() => setToday(isoDateIn(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

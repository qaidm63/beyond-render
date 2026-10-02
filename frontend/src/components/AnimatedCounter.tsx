import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: string;
}

export default function AnimatedCounter({ value }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    // Matches the first number group, supporting decimal points like 15.5 or integers like 100
    const match = value.match(/(\d[\d\s,.]*)/);
    if (!match) {
      setDisplayValue(value);
      return;
    }

    const matchedStr = match[1];
    // Clean string from spacing and commas for correct float parser
    const numberString = matchedStr.replace(/[\s,]/g, "");
    const finalNumberVal = parseFloat(numberString);

    if (isNaN(finalNumberVal)) {
      setDisplayValue(value);
      return;
    }

    const index = match.index ?? 0;
    const prefix = value.slice(0, index);
    const suffix = value.slice(index + matchedStr.length);

    if (!isInView) {
      // Initialize with zero or base value before screen presence
      const baseStart = finalNumberVal > 2000 && finalNumberVal < 2100 ? "2000" : "0";
      setDisplayValue(`${prefix}${baseStart}${suffix}`);
      return;
    }

    let start = 0;
    // Elegant starting threshold for years like "2050" or "2026"
    if (finalNumberVal > 2000 && finalNumberVal < 2100) {
      start = 2000;
    }

    const duration = 1800; // Elegant duration for Premium UX feel
    const startTime = performance.now();
    let animationFrameId: number;

    const updateCounter = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // Quartic easeOut for super smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const currentVal = start + (finalNumberVal - start) * easeProgress;

      // Smart notation determination
      const isInteger = Number.isInteger(finalNumberVal);
      const formattedVal = isInteger 
        ? Math.round(currentVal).toString()
        : currentVal.toFixed(1);

      setDisplayValue(`${prefix}${formattedVal}${suffix}`);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCounter);
      }
    };

    animationFrameId = requestAnimationFrame(updateCounter);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, isInView]);

  return (
    <span ref={ref} className="tabular-nums transition-all duration-300">
      {displayValue || value}
    </span>
  );
}

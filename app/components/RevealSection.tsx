"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./RevealSection.module.css";

/**
 * Opacity 0->1 + 8px translate on 15% visibility, spring-like ease, fires once.
 * Spec §3.7 — applied to at most the first three sections below the fold by
 * the caller; this component itself has no opinion on which sections use it.
 */
export function RevealSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={[styles.reveal, visible ? styles.visible : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { mountScrollWorld } from "../lib/scroll-world/scrub-engine.js";
import styles from "./ScrollWorldExperience.module.css";

const STILL = (name: string) => `/scroll-world/stills/${name}.webp`;
const CLIP = (name: string) => `/scroll-world/vid/${name}.mp4`;

const SECTIONS = [
  {
    id: "north",
    label: "הצפון",
    still: STILL("scene0_north"),
    clip: CLIP("leg0_north"),
    accent: "#1a4d8f",
    scroll: 1.5,
    linger: 0.35,
    eyebrow: "מהצפון",
    title: "ממטולה ועד הגליל",
    body: "קהילות הגבול, השומרים על הבית.",
    tags: ["ביטחון", "גבול צפון"],
  },
  {
    id: "center",
    label: "המרכז",
    still: STILL("scene1_center"),
    clip: CLIP("leg1_center"),
    accent: "#9b00d6",
    scroll: 1.3,
    eyebrow: "במרכז הארץ",
    title: "מהעיר אל הרחוב",
    body: "מתנדבים, פעילים, ומטה שקם מלמטה.",
    tags: ["התנדבות", "קהילה"],
  },
  {
    id: "jerusalem",
    label: "ירושלים",
    still: STILL("scene2_jerusalem"),
    clip: CLIP("leg2_jerusalem"),
    accent: "#6f4797",
    scroll: 1.4,
    linger: 0.3,
    eyebrow: "בירת ישראל",
    title: "ירושלים — הבית הפוליטי שלנו",
    body: "כאן, במרכז ההחלטות, נשמע קולכם.",
    tags: ["ירושלים"],
  },
  {
    id: "south",
    label: "הדרום",
    still: STILL("scene3_south"),
    clip: CLIP("leg3_south"),
    accent: "#b4762a",
    scroll: 1.4,
    linger: 0.3,
    eyebrow: "בעוטף ובדרום",
    title: "מאז ה-7.10, קמים ובונים",
    body: "החוסן של תושבי הדרום הוא הבסיס לדרך.",
    tags: ["חוסן", "דרום"],
  },
  {
    id: "hero",
    label: "כולם יחד",
    still: STILL("scene4_hero"),
    clip: CLIP("leg4_hero"),
    accent: "#4d2472",
    scroll: 1.6,
    linger: 0.4,
    eyebrow: "כל הארץ, יחד",
    title: "עמך ישראל",
    body: "יש על מי לסמוך. יש למי להצביע.",
    cta: {
      primary: { label: "אני מצטרף/ת", href: "/join" },
    },
  },
];

export function ScrollWorldExperience() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || container.dataset.mounted === "true") return;
    container.dataset.mounted = "true";

    mountScrollWorld(container, {
      brand: { name: "עמך ישראל", href: "#top" },
      nav: true,
      atmosphere: true,
      hint: "גללו כדי להמריא",
      cta: { label: "אני מצטרף/ת", href: "/join" },
      crossfade: 0.08,
      sections: SECTIONS,
      connectors: [],
    });

    return () => {
      container.innerHTML = "";
      delete container.dataset.mounted;
    };
  }, []);

  return <div id="top" ref={containerRef} dir="ltr" className={styles.root} />;
}

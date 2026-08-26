"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CtaButton } from "./CtaButton";
import styles from "./Nav.module.css";

const NAV_LINKS = [
  { href: "#lineup", label: "הנבחרת" },
  { href: "#volunteer", label: "רוצה להתנדב" },
  { href: "#contact", label: "צור קשר" },
];

/**
 * Spec §3.6 — no blur (Lottielab wins over Apple translucency). At
 * scrollY === 0 the hairline is absent; it fades in once the page scrolls,
 * so chrome separates itself only when it actually overlaps content.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        <a href="#top" className={styles.logo} aria-label="עמך ישראל">
          <Image src="/logo-mark.svg" alt="" width={144} height={28} priority />
        </a>

        <nav className={styles.links} aria-label="ניווט ראשי">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </a>
          ))}
        </nav>

        <CtaButton href="/join">הצטרפו אלינו</CtaButton>
      </div>
    </header>
  );
}

import Image from "next/image";
import styles from "./MissionBand.module.css";

/**
 * Spec §5.2 — one of only two --canvas-warm uses on the page. No accent
 * color here at all; the quote carries it.
 */
export function MissionBand() {
  return (
    <section className={styles.band}>
      <div className={styles.inner}>
        <blockquote className={`text-heading ${styles.quote}`}>
          הכיסא לא מעניין אותנו, העם מעניין אותנו
        </blockquote>
        <Image
          src="/signature.png"
          alt="חתימת עופר וינטר"
          width={200}
          height={113}
          className={styles.signature}
        />
      </div>
    </section>
  );
}

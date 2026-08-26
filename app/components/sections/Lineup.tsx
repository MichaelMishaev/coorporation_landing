import Image from "next/image";
import styles from "./Lineup.module.css";

/**
 * Spec §5.4 (revised) — the real asset is one composite two-row cutout, not
 * per-member crops. Rendered full-bleed, object-fit: contain, no card chrome.
 * No name/role legend yet — that data hasn't been supplied (see spec §8).
 */
export function Lineup() {
  return (
    <section id="lineup" className={styles.section}>
      <div className={styles.inner}>
        <h2 className="text-heading">הנבחרת</h2>
        <Image
          src="/team-two-rows.png"
          alt="הנבחרת שלנו"
          width={1080}
          height={703}
          className={styles.photo}
        />
      </div>
    </section>
  );
}

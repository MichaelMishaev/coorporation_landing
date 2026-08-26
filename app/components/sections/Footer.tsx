import Image from "next/image";
import styles from "./Footer.module.css";

/**
 * Spec §5.8 / §7 — contact, social, legal only. Hard rule: no link to the
 * management app, no admin/login affordance of any kind.
 */
export function Footer() {
  return (
    <footer id="contact" className={styles.footer}>
      <div className={styles.inner}>
        <Image src="/logo-mark.svg" alt="" aria-hidden="true" width={123} height={24} />

        <div className={styles.social}>
          <a
            className={`text-label ${styles.socialLink}`}
            href="https://www.facebook.com/amchaisraelparty/"
            target="_blank"
            rel="noopener noreferrer"
          >
            פייסבוק
          </a>
          <a
            className={`text-label ${styles.socialLink}`}
            href="https://www.instagram.com/amcha_israel/"
            target="_blank"
            rel="noopener noreferrer"
          >
            אינסטגרם
          </a>
        </div>

        <div className={`text-caption ${styles.legal}`}>
          <a href="/privacy">מדיניות פרטיות</a>
          <a href="/accessibility">הצהרת נגישות</a>
        </div>

        <p className={`text-caption ${styles.copyright}`}>© עמך ישראל</p>
      </div>
    </footer>
  );
}

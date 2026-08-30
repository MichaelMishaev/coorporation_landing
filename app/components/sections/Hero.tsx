import Image from "next/image";
import Link from "next/link";
import styles from "./Hero.module.css";

const SUPPORTER_AVATARS = [
  "/team-avatar-1.jpg",
  "/team-avatar-2.jpg",
  "/team-avatar-3.jpg",
  "/team-avatar-4.jpg",
  "/team-avatar-5.jpg",
];

/**
 * Redesigned from the GoFundMe-style centered-lockup pattern per direct
 * product feedback: the source site's giant logo has no real CTA behind it.
 * This keeps the page's token palette but leads with real faces (small
 * avatar cluster, not a big image) and a single unmissable pill CTA.
 */
export function Hero() {
  return (
    <section id="top" className={styles.hero}>
      <div className={styles.inner}>
        <Image
          src="/logo-mark.svg"
          alt="עמך ישראל בראשות עופר וינטר"
          width={144}
          height={28}
          className={styles.mark}
          priority
        />

        <h1 className="text-display">הקמנו תנועה לאומית ימנית חדשה</h1>
        <p className={`text-subheading ${styles.subheading}`}>
          הצטרפו אלינו ותנו לנו את הכח להילחם למענכם
        </p>

        <div className={styles.avatars}>
          <div className={styles.avatarRow}>
            {SUPPORTER_AVATARS.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={144}
                height={144}
                priority
                className={`${styles.avatar} ${i === 2 ? styles.avatarLead : ""}`}
              />
            ))}
          </div>
          <span className={`text-label ${styles.avatarsLabel}`}>
            חלק מהאנשים שכבר איתנו
          </span>
        </div>

        <Link href="/join" className={styles.ctaBar}>
          <span className={styles.ctaLabel}>אני מצטרף/ת</span>
          <span className={styles.ctaIcon} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 6L9 12L15 18"
                stroke="var(--accent-cta)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </Link>

        <p className={`text-caption ${styles.caption}`}>
          הרשמה בפחות מדקה · שם, טלפון ועיר בלבד
        </p>
      </div>
    </section>
  );
}

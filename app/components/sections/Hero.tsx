import Image from "next/image";
import { CtaButton } from "../CtaButton";
import styles from "./Hero.module.css";

/** Spec §5.1 — GoFundMe centered hero pattern. Static, no motion, no gradient wash. */
export function Hero() {
  return (
    <section id="top" className={styles.hero}>
      <div className={styles.inner}>
        <Image
          src="/logo-lockup.svg"
          alt="עמך ישראל בראשות עופר וינטר"
          width={420}
          height={101}
          className={styles.logo}
          priority
        />
        <h1 className="text-display">הקמנו תנועה לאומית ימנית חדשה</h1>
        <p className={`text-subheading ${styles.subheading}`}>
          הצטרפו אלינו ותנו לנו את הכח להילחם למענכם
        </p>
        <CtaButton href="/join">אני מצטרף/ת</CtaButton>
        <p className={`text-caption ${styles.caption}`}>
          הרשמה בפחות מדקה · שם, טלפון ועיר בלבד
        </p>
      </div>
    </section>
  );
}

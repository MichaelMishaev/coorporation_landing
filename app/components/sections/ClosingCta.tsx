import Image from "next/image";
import { CtaButton } from "../CtaButton";
import styles from "./ClosingCta.module.css";

/** Spec §5.7 — the terminal conversion moment. Logo mark beneath as a signature. */
export function ClosingCta() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <p className="text-display">הצטרפו אלינו ותנו לנו את הכח להילחם למענכם</p>
        <CtaButton href="/join">אני מצטרף/ת</CtaButton>
        <Image
          src="/logo-mark.svg"
          alt=""
          aria-hidden="true"
          width={144}
          height={28}
          className={styles.signature}
        />
      </div>
    </section>
  );
}

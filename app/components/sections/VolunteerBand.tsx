import { CtaButton } from "../CtaButton";
import styles from "./VolunteerBand.module.css";

/**
 * Spec §5.6 — same destination as every other CTA (/join). Secondary/outline
 * button, because the nav's filled CTA is on screen at the same time and the
 * one-chromatic-moment rule has to hold at every scroll position.
 */
export function VolunteerBand() {
  return (
    <section id="volunteer" className={styles.section}>
      <div className={styles.inner}>
        <h2 className="text-heading">רוצה להתנדב?</h2>
        <p className={`text-body ${styles.body}`}>
          שאלת ההתנדבות היא חלק מאותה הרשמה קצרה — אין צורך בטופס נפרד.
        </p>
        <CtaButton href="/join" variant="secondary">
          רוצה לקחת חלק פעיל
        </CtaButton>
      </div>
    </section>
  );
}

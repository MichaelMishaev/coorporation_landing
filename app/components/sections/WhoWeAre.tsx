import styles from "./WhoWeAre.module.css";

/**
 * Spec §5.3 — connective copy, flagged for product-owner sign-off. Restates,
 * without extending, what the live site says.
 */
export function WhoWeAre() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <h2 className={`text-heading ${styles.heading}`}>עַמְּךָ ישראל</h2>
        <div className={styles.copy}>
          <p className={`text-body ${styles.body}`}>
            עמך ישראל היא תנועה לאומית ימנית חדשה, בראשות עופר וינטר. הוקמה מתוך אמונה
            שהשירות לציבור קודם לכל תפקיד או מעמד.
          </p>
          <p className={`text-body ${styles.body}`}>
            הצוות שלנו הגיע מתוך שדה הפעולה האמיתי, ולא מתוך הפוליטיקה — ומחויב להמשיך
            ולפעול למען העם, לא למען הכיסא.
          </p>
        </div>
      </div>
    </section>
  );
}

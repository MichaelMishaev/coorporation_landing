export const metadata = { title: "הצהרת נגישות | עמך ישראל" };

/**
 * Placeholder — spec §9: accessibility statement content is a legal/content
 * deliverable, not decided in the design spec. Replace before launch.
 */
export default function AccessibilityPage() {
  return (
    <main style={{ maxWidth: "65ch", margin: "0 auto", padding: "64px 24px" }}>
      <h1 className="text-heading">הצהרת נגישות</h1>
      <p className="text-body" style={{ marginTop: 24 }}>
        עמוד זה ממתין לתוכן משפטי סופי. אין להשיק את האתר לציבור עם עמוד זה במצבו
        הנוכחי.
      </p>
    </main>
  );
}

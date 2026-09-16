"use client";

import { useEffect, useState } from "react";
import styles from "./SignupForm.module.css";

type City = { id: string; name: string };

type Step = "loading" | "inactive" | "form" | "submitting" | "done";

/**
 * Response contract assumed from the not-yet-implemented management-app
 * backend, per docs/features/leadMachine/2026-08-26-supporter-self-signup-design.md.
 * Update this type the moment that backend lands if the real shape differs.
 */
type SupportSignupResponse = {
  id: string;
  declarationToken: string;
};

const INTEREST_OPTIONS: { value: "yes" | "maybe" | "supporter_only"; label: string }[] = [
  { value: "yes", label: "כן, אשמח להתנדב" },
  { value: "maybe", label: "אולי, אפשר לחזור אליי" },
  { value: "supporter_only", label: "כרגע רק תומך/ת" },
];

export function SignupForm({ linkCode }: { linkCode: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [cities, setCities] = useState<City[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cityId, setCityId] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [declaration, setDeclaration] = useState<SupportSignupResponse | null>(null);
  const [interestAnswered, setInterestAnswered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkLinkAndLoadCities() {
      try {
        const [linkRes, citiesRes] = await Promise.all([
          fetch(`/api/proxy/support-links/${linkCode}`),
          fetch("/api/proxy/cities"),
        ]);

        if (cancelled) return;

        if (!linkRes.ok) {
          setStep("inactive");
          return;
        }

        const citiesData = citiesRes.ok ? await citiesRes.json() : { cities: [] };
        setCities(citiesData.cities ?? []);
        setStep("form");
      } catch {
        if (!cancelled) setStep("inactive");
      }
    }

    checkLinkAndLoadCities();
    return () => {
      cancelled = true;
    };
  }, [linkCode]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!privacyAccepted) {
      setError("יש לאשר את תנאי השימוש ומדיניות הפרטיות");
      return;
    }

    setStep("submitting");

    try {
      const response = await fetch("/api/proxy/support-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          cityId,
          linkCode,
          clientSubmissionId: crypto.randomUUID(),
          privacyAccepted,
          honeypot,
        }),
      });

      if (!response.ok) {
        setError("אירעה שגיאה. נסו שוב בעוד רגע.");
        setStep("form");
        return;
      }

      const data: SupportSignupResponse = await response.json();
      setDeclaration(data);
      setStep("done");
    } catch {
      setError("אירעה שגיאה. נסו שוב בעוד רגע.");
      setStep("form");
    }
  }

  async function handleInterest(interest: "yes" | "maybe" | "supporter_only") {
    if (!declaration) return;
    setInterestAnswered(true); // thank-you stays visible regardless — optional action

    try {
      await fetch(`/api/proxy/support-signup/${declaration.id}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interest,
          declarationToken: declaration.declarationToken,
        }),
      });
    } catch {
      // Interest is a secondary action — the support declaration already
      // succeeded. Failing quietly here matches the sibling spec's rule
      // that optional automation never invalidates a completed signup.
    }
  }

  if (step === "loading") {
    return (
      <div className={styles.wrap}>
        <p className="text-body">טוען...</p>
      </div>
    );
  }

  if (step === "inactive") {
    return (
      <div className={styles.wrap}>
        <p className={`text-body ${styles.error}`}>הקישור אינו פעיל</p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className={`${styles.wrap} ${styles.thankYou}`}>
        <h1 className="text-heading">תודה שהצטרפת כתומכ/ת!</h1>
        <p className="text-body">יחד נוכל להשפיע.</p>

        {interestAnswered ? (
          <p className="text-body">תודה על התשובה!</p>
        ) : (
          <div className={styles.field}>
            <p className="text-label">רוצה לקחת חלק פעיל בקמפיין?</p>
            <div className={styles.interestOptions}>
              {INTEREST_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={styles.interestButton}
                  onClick={() => handleInterest(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form className={styles.wrap} onSubmit={handleSubmit} noValidate>
      <h1 className="text-heading">מצטרפ/ת כתומכ/ת</h1>

      <div className={styles.field}>
        <label className="text-label" htmlFor="fullName">
          שם מלא
        </label>
        <input
          id="fullName"
          className={styles.input}
          type="text"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className="text-label" htmlFor="phone">
          טלפון נייד
        </label>
        <input
          id="phone"
          className={styles.input}
          type="tel"
          inputMode="numeric"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className="text-label" htmlFor="city">
          עיר
        </label>
        <select
          id="city"
          className={styles.select}
          required
          value={cityId}
          onChange={(event) => setCityId(event.target.value)}
        >
          <option value="" disabled>
            בחר/י עיר
          </option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

      <label className={styles.consent} htmlFor="privacyAccepted">
        <input
          id="privacyAccepted"
          className={styles.checkbox}
          type="checkbox"
          required
          aria-describedby={error ? "signup-error" : undefined}
          checked={privacyAccepted}
          onChange={(event) => setPrivacyAccepted(event.target.checked)}
        />
        <span>
          קראתי ואני מסכים/ה ל
          <a
            className={styles.privacyLink}
            href="https://amchaisrael.co.il/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            תנאי השימוש ולמדיניות הפרטיות
          </a>
        </span>
      </label>

      {/* Honeypot — invisible to real users, spec "Abuse controls" */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {error && (
        <p id="signup-error" role="alert" aria-live="polite" className={`text-body ${styles.error}`}>
          {error}
        </p>
      )}

      <button className={styles.submit} type="submit" disabled={step === "submitting"}>
        מצטרפ/ת כתומכ/ת
      </button>
    </form>
  );
}

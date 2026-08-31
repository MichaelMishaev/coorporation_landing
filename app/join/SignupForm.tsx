"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SignupForm.module.css";

type City = { id: string; name: string };

type Step = "loading" | "inactive" | "form" | "submitting" | "done";

export function SignupForm({ linkCode }: { linkCode: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [cities, setCities] = useState<City[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cityId, setCityId] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const ambiguousFailurePendingRef = useRef(false);

  function invalidateSubmissionIdIfNeeded() {
    if (ambiguousFailurePendingRef.current) {
      ambiguousFailurePendingRef.current = false;
      setSubmissionId(crypto.randomUUID());
    }
  }

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

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError("אנא הזן שם מלא");
      return;
    }

    setStep("submitting");

    try {
      const response = await fetch("/api/proxy/support-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: trimmedName,
          phone,
          ...(cityId ? { cityId } : {}),
          linkCode,
          clientSubmissionId: submissionId,
          honeypot,
        }),
      });

      if (!response.ok) {
        ambiguousFailurePendingRef.current = false;
        setSubmissionId(crypto.randomUUID());
        setError("אירעה שגיאה. נסו שוב בעוד רגע.");
        setStep("form");
        return;
      }

      setStep("done");
    } catch {
      ambiguousFailurePendingRef.current = true;
      setError("אירעה שגיאה. נסו שוב בעוד רגע.");
      setStep("form");
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
      </div>
    );
  }

  return (
    <form className={styles.wrap} onSubmit={handleSubmit}>
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
          maxLength={200}
          value={fullName}
          onChange={(event) => {
            invalidateSubmissionIdIfNeeded();
            setFullName(event.target.value);
          }}
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
          maxLength={30}
          value={phone}
          onChange={(event) => {
            invalidateSubmissionIdIfNeeded();
            setPhone(event.target.value);
          }}
        />
      </div>

      <div className={styles.field}>
        <label className="text-label" htmlFor="city">
          עיר (לא חובה)
        </label>
        <select
          id="city"
          className={styles.select}
          value={cityId}
          onChange={(event) => {
            invalidateSubmissionIdIfNeeded();
            setCityId(event.target.value);
          }}
        >
          <option value="">ללא ציון עיר</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

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

      {error && <p className={`text-body ${styles.error}`}>{error}</p>}

      <button className={styles.submit} type="submit" disabled={step === "submitting"}>
        מצטרפ/ת כתומכ/ת
      </button>
    </form>
  );
}

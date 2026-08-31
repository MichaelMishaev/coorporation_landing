"use client";

import { useRef, useState } from "react";
import styles from "./SignupForm.module.css";
import { CITIES } from "@/lib/cities";

type Step = "form" | "submitting" | "done";

export function SignupForm() {
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cityName, setCityName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const ambiguousFailurePendingRef = useRef(false);
  const lastAttemptedPayloadRef = useRef<string | null>(null);

  function invalidateSubmissionIdIfNeeded() {
    if (ambiguousFailurePendingRef.current) {
      ambiguousFailurePendingRef.current = false;
      setSubmissionId(crypto.randomUUID());
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError("אנא הזן שם מלא");
      return;
    }

    const payloadKey = JSON.stringify({ trimmedName, phone, cityName });

    let idToUse = submissionId;
    if (ambiguousFailurePendingRef.current && payloadKey !== lastAttemptedPayloadRef.current) {
      idToUse = crypto.randomUUID();
    }
    ambiguousFailurePendingRef.current = false;
    lastAttemptedPayloadRef.current = payloadKey;
    if (idToUse !== submissionId) {
      setSubmissionId(idToUse);
    }

    setStep("submitting");

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: trimmedName,
          phone,
          ...(cityName ? { cityName } : {}),
          clientSubmissionId: idToUse,
          website: honeypot,
        }),
      });

      if (!response.ok) {
        if (response.status >= 500) {
          // Server error — we can't tell whether the write actually
          // committed before the response was lost, so treat this like
          // a network failure: keep the same id so a same-payload retry
          // is a safe replay, not a duplicate.
          ambiguousFailurePendingRef.current = true;
        } else {
          ambiguousFailurePendingRef.current = false;
          setSubmissionId(crypto.randomUUID());
        }
        setError("אירעה שגיאה. נסו שוב בעוד רגע.");
        setStep("form");
        return;
      }

      ambiguousFailurePendingRef.current = false;
      setSubmissionId(crypto.randomUUID());
      setStep("done");
    } catch {
      ambiguousFailurePendingRef.current = true;
      setError("אירעה שגיאה. נסו שוב בעוד רגע.");
      setStep("form");
    }
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
          value={cityName}
          onChange={(event) => {
            invalidateSubmissionIdIfNeeded();
            setCityName(event.target.value);
          }}
        >
          <option value="">ללא ציון עיר</option>
          {CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
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

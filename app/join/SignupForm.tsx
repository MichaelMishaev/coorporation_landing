"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import styles from "./SignupForm.module.css";
import { CityCombobox } from "./CityCombobox";
import { CITIES } from "@/lib/cities";

type Step = "form" | "submitting" | "done";

const SITE_URL = "https://amchaisrael.co.il/";

// Israeli mobile numbers: "05" + 8 more digits, 10 digits total.
const PHONE_PATTERN = /^05\d{8}$/;

/** Visible text link (not just the logo image) so the site link is
 * unambiguous even without hovering — per direct feedback that the
 * logo alone didn't read as clickable. */
function SiteFooterLink() {
  return (
    <footer className={styles.footer}>
      <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
        amchaisrael.co.il
      </a>
    </footer>
  );
}

/** `phone` state always holds raw digits only (matches the wire contract
 * unchanged — no dashes sent to the server); this derives the dashed
 * display string, e.g. "0501234567" -> "050-1234567". */
function formatPhoneForDisplay(digits: string): string {
  return digits.length <= 3 ? digits : `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

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

    if (!PHONE_PATTERN.test(phone)) {
      setError("מספר טלפון נייד לא תקין. לדוגמה: 050-1234567");
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
      <div className={styles.wrap}>
        <div className={styles.thankYou}>
          <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className={styles.markLink}>
            <Image
              src="/logo-mark.svg"
              alt="עמך ישראל"
              width={144}
              height={28}
              className={styles.mark}
              priority
            />
          </a>
          <h1 className="text-heading">תודה שהצטרפת כתומכ/ת!</h1>
          <p className="text-body">יחד נוכל להשפיע.</p>
        </div>
        <SiteFooterLink />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className={styles.markLink}>
          <Image
            src="/logo-mark.svg"
            alt="עמך ישראל"
            width={144}
            height={28}
            className={styles.mark}
            priority
          />
        </a>
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
            maxLength={12}
            value={formatPhoneForDisplay(phone)}
            onChange={(event) => {
              invalidateSubmissionIdIfNeeded();
              setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
            }}
          />
        </div>

        <div className={styles.field}>
          <label className="text-label" htmlFor="city">
            עיר (לא חובה)
          </label>
          <CityCombobox
            id="city"
            cities={CITIES}
            value={cityName}
            onChange={(newValue) => {
              invalidateSubmissionIdIfNeeded();
              setCityName(newValue);
            }}
          />
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
      <SiteFooterLink />
    </div>
  );
}

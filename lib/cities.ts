/**
 * Static city list for the standalone signup form. Not a DB table, not
 * fetched over the network — per docs/features/standalone-signup/spec.md
 * "City list": nothing about this list needs to be admin-editable or
 * queried, it's a fixed set of Israeli city names for a single-client
 * campaign app. Exact contents are an implementation-time choice per that
 * same section — this is a reasonable starting list of major population
 * centers, not an exhaustive one; growing it later is a one-line change.
 */
export const CITIES = [
  "תל אביב-יפו",
  "ירושלים",
  "חיפה",
  "ראשון לציון",
  "פתח תקווה",
  "אשדוד",
  "נתניה",
  "באר שבע",
  "בני ברק",
  "חולון",
  "רמת גן",
  "אשקלון",
  "רחובות",
  "בת ים",
  "כפר סבא",
  "הרצליה",
  "חדרה",
  "מודיעין-מכבים-רעות",
  "נצרת",
  "לוד",
] as const;

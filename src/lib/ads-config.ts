/**
 * Google Ads conversion tracking config.
 *
 * To activate:
 *   1. In Google Ads, go to Tools → Conversions and create:
 *        - "Signup" conversion action  (copy its label)
 *        - "Trial Started" conversion action (copy its label)
 *      The conversion ID looks like "AW-1234567890".
 *      The label looks like "abcDEFghiJKL" (the part after the "/" in the tag).
 *   2. Fill in the three constants below. Leave any blank to disable.
 *   3. Redeploy. Tracking will load on every page automatically.
 *
 * No PII is sent — only an event name plus the conversion label.
 */
export const GOOGLE_ADS_ID = "";        // e.g. "AW-1234567890"
export const GADS_SIGNUP_LABEL = "";    // e.g. "abcDEFghiJKL"
export const GADS_TRIAL_LABEL = "";     // e.g. "xyzABCdefGHI"

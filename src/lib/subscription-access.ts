export type SubscriptionAccessRow = {
  status: string;
  current_period_end: string | null;
};

const ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Scheduled cancellations remain `active` until the billing period ends.
 * A `canceled` status therefore means the cancellation is effective and access
 * must stop, even when the provider still includes the former period end date.
 */
export function hasSubscriptionAccess(
  subscription: SubscriptionAccessRow | null | undefined,
  now = Date.now(),
) {
  if (!subscription || !ACCESS_STATUSES.has(subscription.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > now;
}

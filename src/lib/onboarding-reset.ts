type Membership = {
  organization_id?: string;
  role: string;
  organization?: { business_profile?: unknown };
};

export function pendingOnboarding(memberships: Membership[]) {
  return memberships.find((membership) => {
    if (membership.role !== "owner") return false;
    const profile = membership.organization?.business_profile as
      { setup?: { onboarding_required?: boolean } } | null;
    return profile?.setup?.onboarding_required === true;
  });
}

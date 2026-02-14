export type UserType = "guest" | "regular";

type Entitlements = {
  dailyCredits: number;
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    dailyCredits: Number(process.env.GUEST_DAILY_CREDITS ?? 40),
  },

  /*
   * For users with an account
   */
  regular: {
    dailyCredits: Number(process.env.REGULAR_DAILY_CREDITS ?? 120),
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};

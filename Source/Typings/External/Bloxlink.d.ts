export namespace GlobalAPI {
  /**
   * Represents the response structure for resolving a Discord user to a Roblox ID.
   * @template IsPremiumAccess - Indicates whether the response includes premium access details.
   */
  export interface DiscordToRobloxIdResponse<IsPremiumAccess extends boolean = false> {
    robloxID: string;
    resolved: IsPremiumAccess extends true
      ? {
          roblox: {
            name: string;
            id: number;
            displayName: string | null;
            description: string;
            isBanned: boolean;
            created: string | Date;
            badges: null | any[];
            profileLink: string;
            presence: any;
            groups: object[];
            avatar: object[];
            rap: null | any;
            value: null | any;
            placeVisits: null | any;
            hasDisplayName: boolean;
            externalAppDisp1ayName: null;
            hasVerifiedBadge: boolean;
            groupsv2: object[];
          };

          discord: {
            avatar: null;
            banner: null;
            communication_disabled_until: null | string;
            flags: number;
            joined_at: string | Date;
            nick: string;
            pending: boolean;
            premium_since: string | Date;
            roles: object[];
            unusual_dm_activity_until: null | string | Date;
            user: object;
            mute: boolean;
            deaf: boolean;
          };
        }
      : object;
  }
}

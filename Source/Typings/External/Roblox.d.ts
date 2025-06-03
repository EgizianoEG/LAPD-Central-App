import { DeepReadonly } from "utility-types";

export namespace APIResponses.Users {
  interface GetUserResponse {
    /** The user's bio/description. */
    description: string;

    /** The date string showing the user's registration date (RFC 3339). */
    created: string;

    /** Whether or not the user is banned. */
    isBanned: boolean;

    /** The display name in an external app. Unused, legacy attribute.
     * For now always `null` to avoid disrupting existing client code that may rely on it.
     * */
    externalAppDisplayName: string | null;

    /** The user's verified badge status. */
    hasVerifiedBadge: boolean;

    /** The unique identifier for the user. */
    id: number;

    /** The username of the user. */
    name: string;

    /** The display name of the user. */
    displayName: string;
  }

  /** The API response for a user search by keyword using {@link https://users.roblox.com/v1/usernames/users} Roblox endpoint */
  interface UserSearchPOSTResponse {
    /** Users discovered through the api request. */
    data: Users.UserSearchResult[];
  }

  /** An object representing a user search result for the endpoint "https://users.roblox.com/v1/usernames/users" */
  interface UserSearchResult {
    /** The id of the user. */
    id: number;

    /** The username used in the request. */
    requestedUsername: string;

    /** The username of the user. */
    name: string;

    /** The display name of the user. */
    displayName: string;

    /** A comma-separated stringified list of the user's previous usernames e.g. "roblox, roblox2, roblox3" */
    // previousUsernames: string[];

    /** Whether the user has a verified badge. Not reliable. */
    hasVerifiedBadge: boolean;
  }

  interface MultiGetByNameResponse {
    data: [
      {
        id: number;
        name: string;
        displayName: string;
        hasVerifiedBadge: boolean;
        requestedUsername: string;
      },
    ];
  }
}

export namespace APIResponses.Presence {
  interface UserPresencesResponse {
    userPresences: [
      {
        /** The Id of the user. */
        userId: number;

        /** User presence Type.
         * Enums: ['Offline': `0`, 'Online': `1`, 'InGame': `2`, 'InStudio': `3`, 'Invisible': `4`]
         * */
        userPresenceType: 0 | 1 | 2 | 3 | 4;

        /** The user's last location if applicable. Could be an empty string (`""`). */
        lastLocation: string;

        /** The Id of the current place. Available if the user status is `2` (In Game). */
        placeId: number | null;

        /** The Id of the root place. Available if the user status is `2` (In Game). */
        rootPlaceId: number | null;

        /** The Id of the game as a UUID string. Available if the user status is `2` (In Game). */
        gameId: string | null;

        /** The Id of the universe. Available if the user status is `2` (In Game). */
        universeId: number | null;

        /** The last seen date string. Can be convert to normal Date object. */
        lastOnline: string;

        // Unknown presence:
        // invisibleModeExpiry: string;
      },
    ];
  }
}

export namespace APIResponses.Thumbnails {
  interface ThumbnailResponse {
    data: {
      /** The state of the response. */
      state: keyof APITypes.Thumbnails.ResponseStates;

      /** The targetted user id. */
      targetId: number;

      /** The image url of the targetted user's thumbnail. */
      imageUrl: string;

      version: string;
    }[];
  }
}

export namespace APITypes.Thumbnails {
  type ImageFormat = "png" | "jpeg";
  type AvatarCropSizes = "body" | "bust" | "headshot";
  type ResponseStates = DeepReadonly<{
    Error: 0;
    Completed: 1;
    InReview: 2;
    Pending: 3;
    Blocked: 4;
    TemporarilyUnavailable: 5;
  }>;

  interface ThumbSizes {
    readonly bust: [
      "48x48",
      "50x50",
      "60x60",
      "75x75",
      "100x100",
      "150x150",
      "180x180",
      "352x352",
      "420x420",
    ];
    readonly body: [
      "30x30",
      "48x48",
      "60x60",
      "75x75",
      "100x100",
      "110x110",
      "140x140",
      "150x150",
      "150x200",
      "180x180",
      "250x250",
      "352x352",
      "420x420",
      "720x720",
    ];
    readonly headshot: [
      "48x48",
      "50x50",
      "60x60",
      "75x75",
      "100x100",
      "110x110",
      "150x150",
      "180x180",
      "352x352",
      "420x420",
      "720x720",
    ];
  }
}

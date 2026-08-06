import type { RolePersist } from "#Source/Typings/Utilities/Database.js";
import RolePersistenceModel from "#Models/RolePersist.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";

type RolePersistDoc = RolePersist.RolePersistDocument;
const RefreshIntervalMs = 10 * 60 * 1000; // 10 minutes
const LogLabel = "Utilities:Database:RolePersists";

// Guild -> User -> Document.
let Store: Map<string, Map<string, RolePersistDoc>> = new Map();
let RefreshInFlight: Promise<void> | null = null;
let RefreshTimer: NodeJS.Timeout | null = null;

/**
 * Pulls every role persist document from the database and rebuilds the
 * in-memory store from scratch. Concurrent calls share the same in-flight
 * refresh instead of triggering duplicate queries.
 */
export async function RefreshRolePersistsStore(): Promise<void> {
  if (RefreshInFlight) return RefreshInFlight;

  RefreshInFlight = (async () => {
    try {
      const Documents = (await RolePersistenceModel.find(
        {},
        {},
        { lean: true }
      )) as unknown as RolePersistDoc[];

      const NextStore: typeof Store = new Map();
      for (const Doc of Documents) {
        let GuildEntries = NextStore.get(Doc.guild);
        if (!GuildEntries) {
          GuildEntries = new Map();
          NextStore.set(Doc.guild, GuildEntries);
        }
        GuildEntries.set(Doc.user, Doc);
      }

      Store = NextStore;
    } catch (Err) {
      AppLogger.error({
        message: "Failed to refresh the role persists in-memory store.",
        label: LogLabel,
        stack: (Err as Error)?.stack,
        error: Err,
      });
    } finally {
      RefreshInFlight = null;
    }
  })();

  return RefreshInFlight;
}

/**
 * Starts the periodic background refresh. Call once at bootstrap, *after*
 * awaiting an initial `RefreshRolePersistsStore()` call, so the store isn't
 * empty the moment the process starts handling events.
 */
export function StartRolePersistsAutoRefresh(): void {
  if (RefreshTimer) return;

  RefreshTimer = setInterval(() => {
    RefreshRolePersistsStore().catch(() => null);
  }, RefreshIntervalMs);

  RefreshTimer.unref?.();
}

// ---------------------------------------------------------------------------------------
// Synchronous readers:
// --------------------

/**
 * Whether a user currently has a role persist entry in a guild.
 * @param GuildId - The guild Id to check.
 * @param UserId - The user Id to check.
 * @returns `true` if the user has a role persist entry in the guild, `false` otherwise.
 */
export function HasRolePersist(GuildId: string, UserId: string): boolean {
  return Store.get(GuildId)?.has(UserId) ?? false;
}

/**
 * The raw role persist document for a user in a guild, if any.
 * @param GuildId - The guild Id to check.
 * @param UserId - The user Id to check.
 * @returns The role persist document if it exists, or `undefined` if not.
 */
export function GetRolePersist(GuildId: string, UserId: string): RolePersistDoc | undefined {
  return Store.get(GuildId)?.get(UserId);
}

/**
 * All role persist documents for a guild, or every guild if omitted.
 * @param GuildId - The guild Id to check, or omit to get all role persists.
 * @returns An array of role persist documents.
 */
export function GetRolePersists(GuildId?: string): RolePersistDoc[] {
  if (GuildId) return [...(Store.get(GuildId)?.values() ?? [])];

  const All: RolePersistDoc[] = [];
  for (const GuildEntries of Store.values()) All.push(...GuildEntries.values());
  return All;
}

// ---------------------------------------------------------------------------
// Write-path hook;
// Wherever role persists are created or deleted, these shall be called
// so the store reflects writes immediately instead of waiting up to
// `RefreshIntervalMs` for the next periodic pull.
// ---------------------------------------------------------------------------

export function UpsertCachedRolePersist(Doc: RolePersistDoc): void {
  let GuildEntries = Store.get(Doc.guild);
  if (!GuildEntries) {
    GuildEntries = new Map();
    Store.set(Doc.guild, GuildEntries);
  }
  GuildEntries.set(Doc.user, Doc);
}

export function RemoveCachedRolePersist(GuildId: string, UserId: string): void {
  const GuildEntries = Store.get(GuildId);
  if (!GuildEntries) return;

  GuildEntries.delete(UserId);
  if (GuildEntries.size === 0) Store.delete(GuildId);
}

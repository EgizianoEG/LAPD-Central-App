import {
  RefreshRolePersistsStore,
  StartRolePersistsAutoRefresh,
} from "#Utilities/Database/RolePersists.js";

/**
 * Synchronizes the role persist records by refreshing the store and starting the auto-refresh process.
 * @returns {Promise<void>} A promise that resolves when the synchronization is complete.
 */
export default async function SynchronizeRolePersistRecords(): Promise<void> {
  await RefreshRolePersistsStore().catch(() => null);
  StartRolePersistsAutoRefresh();
}

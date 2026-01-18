import { google, drive_v3, sheets_v4 } from "googleapis";
import { ValidatePrivateKey } from "#Utilities/Helpers/Validators.js";
import { GoogleAuth, JWT } from "google-auth-library";
import { JSONClient } from "google-auth-library/build/src/auth/googleauth.js";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import Secrets from "#Config/Secrets.js";

export let Client: JWT;
export let GAuth: GoogleAuth<JSONClient>;
export let DriveAPI: drive_v3.Drive;
export let SheetsAPI: sheets_v4.Sheets;

/**
 * Initializes the Google API client.
 * @returns {void} A promise that resolves once the client is initialized.
 */
export default async function InitializeGoogleAPI(): Promise<void> {
  try {
    const NormalizedPrivateKey = Secrets.GoogleAPI.PrivateKey.replaceAll(/\\+?n/g, "\n");
    ValidatePrivateKey(NormalizedPrivateKey);

    GAuth = new google.auth.GoogleAuth({
      scopes: Secrets.GoogleAPI.APIScopes,
      credentials: {
        client_email: Secrets.GoogleAPI.ServiceAccountEmail,
        private_key: NormalizedPrivateKey,
        scopes: Secrets.GoogleAPI.APIScopes,
        forceRefreshOnFailure: true,
      },
    });

    Client = (await GAuth.getClient()) as JWT;
    DriveAPI = google.drive({ version: "v3", auth: Client });
    SheetsAPI = google.sheets({ version: "v4", auth: Client });

    AppLogger.info({
      label: "Handlers:GoogleAPI",
      message: "Google auth client initialized successfully.",
      scopes: Client.scopes,
      service_account: Client.email,
      private_key: `[Length: ${Client.key?.length || 0}]: ${Client.key?.slice(0, 800) || "[No Key Found]"}...`,
    });
  } catch (Err: any) {
    AppLogger.error({
      label: "Handlers:GoogleAPI",
      message: "Google API Client Initialization Failed. Some features may be unavailable.",
      scopes: Secrets.GoogleAPI.APIScopes,
      service_account: Secrets.GoogleAPI.ServiceAccountEmail,
      private_key: `[Length: ${Secrets.GoogleAPI.PrivateKey?.length || 0}]: ${Secrets.GoogleAPI.PrivateKey?.slice(0, 800) || "[No Key Found]"}...`,
      stack: Err.stack,
    });
  }
}

/**
 * Retrieves the Google API client.
 * If the client is not initialized, it will be initialized before returning.
 * @returns {Promise<JWT>} A promise that resolves to the Google JWT client.
 */
export async function GetClient(): Promise<JWT> {
  if (!Client) await InitializeGoogleAPI();
  return Client;
}

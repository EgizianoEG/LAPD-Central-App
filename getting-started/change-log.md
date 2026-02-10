---
description: >-
  Track LAPD Central's evolution with detailed release notes, feature additions,
  and bug fixes.
icon: newspaper
---

# Change Log

## [Version 1.12.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.12.0) – February 10, 2026 <sup><sub>_<mark style="color:info;">(Latest)</mark>_<sub></sup>

### Release Notes

Feature + reliability release focused on configuration modularization, user data privacy controls, and improved incident/arrest reporting. Also strengthens deploy/hosting stability with a dedicated Express handler (health + metrics), rate limiting, graceful shutdown, and more resilient MongoDB connection behavior.

### Added

- **Modular `/config` Command Architecture & Roblox Validation**
  - Replaced the monolithic config command with a modular architecture.
  - Improved Roblox-related validation logic to better respect guild settings.
    [`a47b853`](https://github.com/EgizianoEG/LAPD-Central-App/commit/a47b853f16afc46f28932370238dd124edfa50af)

- **Express Server Hardening (Health/Metrics + Rate Limiting)**
  - Moved the Express server into a dedicated handler with comprehensive health checks.
  - Added rate limiting middleware for public endpoints.
  - Expanded health/metrics output for more detailed system and service visibility.
  - Enhanced AppWatchdog with rate-limited status tracking.
    [`4dd8e45`](https://github.com/EgizianoEG/LAPD-Central-App/commit/4dd8e4532825e2b09470e2c3d324b3096b097ad7), [`744a0f9`](https://github.com/EgizianoEG/LAPD-Central-App/commit/744a0f94269687a2dcc92a31fa60309b0d3d697f), [`cdeadad`](https://github.com/EgizianoEG/LAPD-Central-App/commit/cdeadadd379fa6a98ea15a5d7594a958f3458084), [`6ac2f26`](https://github.com/EgizianoEG/LAPD-Central-App/commit/6ac2f2619c688652d9c1c1b065f034802830d74a)

- **Graceful Shutdown & Startup Resilience**
  - Added a centralized process shutdown handler and exposed the server instance for consistent teardown.
  - Ensures graceful shutdown is used even when Discord initialization fails.
    [`cc6f761`](https://github.com/EgizianoEG/LAPD-Central-App/commit/cc6f76185e4594bbd9435cd8f3b77bbe69d00848), [`ab9f0db`](https://github.com/EgizianoEG/LAPD-Central-App/commit/ab9f0db82897e62a0104d8a3857a3aa4d3eb1b2b), [`1113fb4`](https://github.com/EgizianoEG/LAPD-Central-App/commit/1113fb48221a72a0e20d915c63f0a0257c84003b)

- **User Data Deletion & Anonymization (`/preferences`)**
  - Added user data deletion and anonymization support.
  - Added scheduling/unscheduling hooks tied to member leave/join to improve reliability.
    [`a9a2141`](https://github.com/EgizianoEG/LAPD-Central-App/commit/a9a21419657de41000761ab11a1f454ddcae2b2e)

- **Member Roles: Wipe Subcommand**
  - Added a wipe subcommand to delete all stored user role backups.
    [`f64197c`](https://github.com/EgizianoEG/LAPD-Central-App/commit/f64197c476e3e5d4fbefbb29733e98f13f68eba2)

- **Changelog Automation**
  - Introduced a centralized `CHANGELOG.md` and automated documentation sync workflow.
    [`475363f`](https://github.com/EgizianoEG/LAPD-Central-App/commit/475363ffd71ccf94505fb52ab2782105ce2388f8)

- **Documentation Enhancements**
  - Added `llms.txt` project overview and setup instructions for AI assistants.
  - Added pull request template with guidelines and checklist.
  - Updated Copilot instructions with commit/PR conventions and command file structure guidelines.
    [`ce824c9`](https://github.com/EgizianoEG/LAPD-Central-App/commit/ce824c99e5d1c5f5b3e1a6a7e8f9a0b1c2d3e4f5), [`4ca2cc8`](https://github.com/EgizianoEG/LAPD-Central-App/commit/4ca2cc8be4e5d6f7a8b9c0d1e2f3a4b5c6d7e8f9), [`4e16570`](https://github.com/EgizianoEG/LAPD-Central-App/commit/4e165701dc3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a)

### Changed

- **Incident Reports: More Detailed Content & Safer Selection UX**
  - Increased supported report length and detail.
  - Added Discord user select menus and enforced max limits for officers/witnesses.
    [`2e53dec`](https://github.com/EgizianoEG/LAPD-Central-App/commit/2e53decb78d9f8e7e3b61a063cfab8976f65782f), [`6cbfec1`](https://github.com/EgizianoEG/LAPD-Central-App/commit/6cbfec199ba0700e517984b316650431c9f99d0f)

- **Arrest Reporting: Roblox Enforcement & Signature Handling**
  - Enforced Roblox login for reporting officers when enabled by guild settings.
  - Improved signature behavior for reporting officers.
    [`8d65386`](https://github.com/EgizianoEG/LAPD-Central-App/commit/8d65386355519dd751fa1af3444c70c0e9868d27)

- **Duty Manage: End Shift While On Break**
  - Allows ending a shift even when the break state is active, improving user workflows.
    [`d48b4e1`](https://github.com/EgizianoEG/LAPD-Central-App/commit/d48b4e1971f8696ff76d359c7c9c48e24799f953)

- **MongoDB Connectivity Reliability**
  - Optimized connection options and pooling.
  - Added retry/backoff improvements and diagnostics for network/DNS failures.
    [`6e8ed63`](https://github.com/EgizianoEG/LAPD-Central-App/commit/6e8ed634006ed38ff69473ebb7c92c871eaa0105), [`68a61de`](https://github.com/EgizianoEG/LAPD-Central-App/commit/68a61de4618da60e31d03b4d548c6c5fe3bbcae2), [`e9f7a79`](https://github.com/EgizianoEG/LAPD-Central-App/commit/e9f7a79e653936005f93f4092779ab5a74e3e626)

- **Versioning**
  - Bumped version to `1.12.0` in `package.json` and `package-lock.json`.
    [`f318056`](https://github.com/EgizianoEG/LAPD-Central-App/commit/f3180566398a876d36e279507c4338c91f4e5532)

### Fixed

- **Changelog & Workflow Permissions**
  - Corrected latest-version badge styling in changelog header.
  - Set necessary permissions for changelog sync workflow.
    [`2781ad2`](https://github.com/EgizianoEG/LAPD-Central-App/commit/2781ad2d3e7b4c5d6e7f8a9b0c1d2e3f4a5b6c7d), [`d85be8e`](https://github.com/EgizianoEG/LAPD-Central-App/commit/d85be8e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4)

- **Arrest Model Robustness**
  - Made Roblox ID fields optional with safe defaults to avoid report failures on missing data.
    [`3ed8da9`](https://github.com/EgizianoEG/LAPD-Central-App/commit/3ed8da95635d85bf111227e828ae6fb9ea4760d2)

- **Incident Division Calculation**
  - Adjusted division calculation logic in arrest submission to handle edge cases correctly.
    [`7b43d21`](https://github.com/EgizianoEG/LAPD-Central-App/commit/7b43d21098b49562da4542dbd9bc432e9249295b)

- **Autocomplete Formatting for Incident Types**
  - Uses `PascalToNormal` for category names in autocomplete suggestions.
    [`a3c1a72`](https://github.com/EgizianoEG/LAPD-Central-App/commit/a3c1a72a413f25468c0f75bb15d8125f62ff9b45)

- **Metrics Collector CPU Safety**
  - Removed `node-os-utils` dependency and related CPU metric code to prevent runtime errors on unsupported platforms.
    [`d866ba9`](https://github.com/EgizianoEG/LAPD-Central-App/commit/d866ba9f9327f946dfd033c9f0a7f4e4abf83a4a), [`50d3a85`](https://github.com/EgizianoEG/LAPD-Central-App/commit/50d3a8563e9b970be29f3c1283d462b7cbeb0578)

- **GuildProfile Schema**
  - Made `left_at` field optional to prevent validation failures.
    [`3623214`](https://github.com/EgizianoEG/LAPD-Central-App/commit/36232140cb0e3115f4eb90f569f8d9d129ddc32a)

- **User Preferences Update**
  - Added `updatePipeline` option and improved error handling in preferences update flow.
    [`9e93694`](https://github.com/EgizianoEG/LAPD-Central-App/commit/9e93694dd1e141ed2823287d112d005d293287ea)

- **Active Duty Timeframe Display**
  - Only display timeframe information when present for active shifts with unspecified types.
    [`9ce9a3d`](https://github.com/EgizianoEG/LAPD-Central-App/commit/9ce9a3dd38c287aa42374d5d16dfc0b8ca6db9ac)

- **Logging Security**
  - Ensured sensitive request headers are redacted in logging details.
    [`ebead45`](https://github.com/EgizianoEG/LAPD-Central-App/commit/ebead45078a033ca4ab06f8ee4da08c774b83aee)

### Dependencies

- **noblox.js**
  - Updated `noblox.js` from `6.2.0/1` to `7.3.1`.
    [`302d501`](https://github.com/EgizianoEG/LAPD-Central-App/commit/302d501b095eb1577e0d4e2faafee4439a9674f3)

- **mongoose**
  - Bumped `mongoose` from `8.19.1` to `9.1.5` (Dependabot).
    [`b2dcc29`](https://github.com/EgizianoEG/LAPD-Central-App/commit/b2dcc29b415d70828eb24d6bbe0e7b9e6291ac14)

### Full Changelog

[v1.11.0...v1.12.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.11.0...v1.12.0)

## [Version 1.11.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.11.0) – January 22, 2026

### Release Notes

Feature release focused on user experience and data accuracy for duty/activity reporting, plus improved date/time input ergonomics and updated dependency versions. Adds opt-in end-of-shift DM reports, improves activity report correctness and notice handling, and introduces timeframe filtering for historical “active duty” views.

### Added

- **Opt-in End-of-Shift DM Reports (`/preferences`)**
  - Added a new `/preferences` command for per-server user settings.
  - Introduced `dm_shift_reports` preference in the `GuildProfile` schema.
  - Sends a shift-summary DM to opted-in users when shifts end (including admin-ended shifts; DM goes to the target user).
  - Auto-disables the preference after persistent DM delivery failures (e.g., closed DMs).
  - Centralized DM shift report delivery into shared logic to reduce duplication and improve reliability.  
    [`c6e691e`](https://github.com/EgizianoEG/LAPD-Central-App/commit/c6e691ed655be1879fd9cb4fe568b6e310eedb40)

- **Duty Active Timeframe Filtering (Historical Views)**
  - Added optional `"from"` / `"to"` timeframe parameters to filter and view historically “active” duty shifts.
  - Embed output now includes timeframe context and uses Discord date formatting where applicable.
  - Improved shift duration calculations for timeframe views by computing on-duty time from shift start to timeframe end and subtracting breaks that occurred before timeframe end.
  - Detects breaks active at timeframe end for clearer historical annotations.
  - Enhanced date/time option autocompletion with smarter, dynamic suggestions (natural language expressions).  
    [`33baf48`](https://github.com/EgizianoEG/LAPD-Central-App/commit/33baf4832ad78e00865e8c10d5530c4dbaf8de57), [`1319c18`](https://github.com/EgizianoEG/LAPD-Central-App/commit/1319c18f3b4e6634e15785179a33a2ced985a7bd), [`2410eb3`](https://github.com/EgizianoEG/LAPD-Central-App/commit/2410eb3a18ff550534f061e24982ccf116e912e8)

- **Activity Reports: Include Non-Staff with Recorded Shift Time (Optional)**
  - Added an option to include members without staff roles if they have recorded shift time, enabling more complete report generation where needed.  
    [`a35fd4d`](https://github.com/EgizianoEG/LAPD-Central-App/commit/a35fd4dae95e3916f6c0261aeeb0f5bad114bb5f)

### Changed

- **Activity Report Data Source & Aggregation Consistency**
  - Switched activity report retrieval to use `ShiftModel` (instead of `ProfileModel`) and improved the aggregation pipeline, aligning activity report data with shift leaderboard results and fixing mismatches where users could appear on the leaderboard but not in the report.  
    [`9f68969`](https://github.com/EgizianoEG/LAPD-Central-App/commit/9f68969bc74f2ab2e51129e49d00c6c88868859b)

- **Activity Report: Priority-Based Notice Processing**
  - Improved how activity notices are represented and displayed by prioritizing:
    - Active LOA > Active RA > Pending LOA > Pending RA
  - Reduced over-fetching by limiting how many recent notices are loaded, and made notice handling more deterministic and performant.
  - Added comprehensive tests to validate the priority rules and edge cases.  
    [`8bcf4f1`](https://github.com/EgizianoEG/LAPD-Central-App/commit/8bcf4f122266d15549fb235ce960526ee50d240d)

- **Duty Leaderboard Duration Calculation (Stability)**
  - Improved on-duty duration calculation behavior for the leaderboard and then simplified/reverted parts of the change to keep the logic stable and predictable.  
    [`733a521`](https://github.com/EgizianoEG/LAPD-Central-App/commit/733a521b588c364d48485d226b008821126d421b), [`cf5eaaf`](https://github.com/EgizianoEG/LAPD-Central-App/commit/cf5eaaf6aad06cf98474a95f694e45ab2068b7df)

- **Copilot Instructions Documentation**
  - Updated Copilot onboarding docs to clarify and document the (now used) path alias conventions.  
    [`54d9d60`](https://github.com/EgizianoEG/LAPD-Central-App/commit/54d9d60bfc70a9f995c97a7343d6bdb79c4a5bef)

- **Versioning**
  - Bumped version to `1.11.0` in `package.json`.  
    [`43d7faf`](https://github.com/EgizianoEG/LAPD-Central-App/commit/43d7faf1e9fe64e0c8e3714a43b29bff6ba092c8)

### Fixed

- **Duty Active Timeframe Logic & Break/On-Duty Handling**
  - Corrected timeframe computations and break/on-duty handling for historical “active” duty views.
  - Aligned ParseDateInputs option keys (`from`/`to`) and updated user-facing messaging for consistency and clarity.  
    [`1319c18`](https://github.com/EgizianoEG/LAPD-Central-App/commit/1319c18f3b4e6634e15785179a33a2ced985a7bd)

- **LOA Embed Text Consistency**
  - Standardized “Approved By” to “Approved by” in LOA embeds for consistent copy.  
    [`0d6bfc8`](https://github.com/EgizianoEG/LAPD-Central-App/commit/0d6bfc81f7b5b329e3e1ac55dea86b6603cc6daa)

### Dependencies

- **discord.js**
  - Updated `discord.js` to `14.25.1`.  
    [`5c312f3`](https://github.com/EgizianoEG/LAPD-Central-App/commit/5c312f3c457669c0c1f8682a05c32b81449038f0)

- **jws (indirect)**
  - Bumped `jws` from `4.0.0` to `4.0.1` (Dependabot).  
    [`489bf02`](https://github.com/EgizianoEG/LAPD-Central-App/commit/489bf02b51eb9d6eb5ba1cfe5c942750f6134742)

### Full Changelog

[v1.10.1...v1.11.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.10.1...v1.11.0)

---

## [Version 1.10.1](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.10.1) – December 4, 2025

### Release Notes

Patch release focusing on stability and UX around logging, duty import, Roblox info handling, LOA interactions, and DA models. Includes a production dependency bump for Express.

### Changed

- **Duty Import Experience**
  - Loosened user and guild import cooldowns to make bulk imports more practical.
  - Clarified imported data summary labels for better readability and consistency.

- **Roblox Info Lookup**
  - `get-rblx-info` now returns a placeholder “banned/nonexistent user” style response when user ID is `0`.
  - Prevents exceptions for invalid IDs and makes handling nonexistent users more predictable.  
    [`b7d638f`](https://github.com/EgizianoEG/LAPD-Central-App/commit/b7d638f4a265009b1db4666ec78bdab13e31f2ad)

- **DA Models – Signature Rules**
  - Reduced the minimum required signature length from 3 to 1 character.
  - Allows for short but valid signatures (e.g., short Discord nicknames).  
    [`8d52753`](https://github.com/EgizianoEG/LAPD-Central-App/commit/8d527535d9a4b72cc32d46735bc1f83c0195493a)

- **Versioning**
  - Bumped version to `1.10.1` in `package.json` and `package-lock.json`.  
    [`e528b3e`](https://github.com/EgizianoEG/LAPD-Central-App/commit/e528b3e683a52b1192839d1d0c52d396a5be89cb)

### Fixed

- **Duty Import**
  - Refined leaderboard entry regex to support a wider range of input formats.  
    [`4405ac5`](https://github.com/EgizianoEG/LAPD-Central-App/commit/4405ac51301e46a8fc9b0c305ad1cdab9ed44bea)

- **Logging**
  - Improved error logging by passing error objects directly to the logger instead of spreading them.
  - Ensures non-enumerable properties (like stack traces) are preserved and visible.
  - Clarified user-facing error feedback messages for better understanding.  
    [`5571888`](https://github.com/EgizianoEG/LAPD-Central-App/commit/5571888d4eb3651256f44a120b8bbe7e50ede556)

- **LOA Interactions**
  - Ensured ephemeral and component-v2 flags are correctly set for extension cancellation prompts.
  - Refactored interaction edits to operate on the original message and consistently disable components.
  - Streamlined reply logic to behave correctly both with and without embeds.  
    [`f11d7fb`](https://github.com/EgizianoEG/LAPD-Central-App/commit/f11d7fb419ca5571697d10d87f1f768edc490f5b)

### Dependencies

- **Express**
  - Updated `express` from `5.1.0` to `5.2.0` via Dependabot.
  - Production dependency (`direct:production`) in the root (`/`) `npm_and_yarn` group.  
    [`99eae5f`](https://github.com/EgizianoEG/LAPD-Central-App/commit/99eae5f71b8bce7930352849c3fafeb7ab242b06)

### Full Changelog

[v1.10.0...v1.10.1](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.10.0...v1.10.1)

---

## [Version 1.10.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.10.0) – November 26, 2025

### Release Notes

Quite major update focusing on config flexibility, better module traceability, robust database/change handling, and Discord.js/core dependency upgrades. Features significant enhancements to guild/member/data handling, role/incident config options, and security reliability.

### Added

- **Config Command: Disable Roblox Authorization**  
  - New ability to enable/disable Roblox authentication and guard Roblox-dependent features accordingly:
    - Prevents enabling features that require Roblox auth when it is disabled.
    - Blocks disabling roblox auth if dependent options are active.
    - Adds clear error messages for any setting/apply conflict, improving administrator UX.  
    [62d98f0](https://github.com/EgizianoEG/LAPD-Central-App/commit/62d98f01a3dc3e53c593a90fbb26b1cab30cdde1)

- **Command Logging Traceability**  
  - **Includes Guild ID in all command execution and error logs** for deeper traceability.  
    [952aa91](https://github.com/EgizianoEG/LAPD-Central-App/commit/952aa913bfd4461b8de1fcd209632dec112c12c0)

### Changed

- **Discord.js & Dependencies**  
  - `discord.js` updated: 14.24.1 → 14.25.0  
  - `@discordjs/formatters`: 0.6.1 → 0.6.2  
  - `@discordjs/util`: 1.1.1 → 1.2.0  
  - `discord-api-types`: 0.38.31 → 0.38.34  
  - `js-yaml` security patches & `glob` minor update  
    [7787a42](https://github.com/EgizianoEG/LAPD-Central-App/commit/7787a42484c3abf4ec8dcf671f0fa589d0d27f10)

- **Improved Guild Member Caching & Snapshots**  
  - Upgrades in-flight fetch tracking/cooldown for more efficient and accurate guild member snapshot cache refreshes.
  - Sync mechanism on join/leave/update events.  
    [46352eb](https://github.com/EgizianoEG/LAPD-Central-App/commit/46352ebd5b0f5ee4ae35821459e2043cb3f1291d)

- **Role ID Checks Performance**  
  - Role/permission lookups now use `Set` for faster mappers/scans.  
    [57fe073](https://github.com/EgizianoEG/LAPD-Central-App/commit/57fe073db013b7bda08b42378b7dd75d3bdc4a91)

- **Discord Presence Logic**  
  - Presence now set with `setPresence` and custom activity, clarifying bot status is updated properly.  
    [44799b4](https://github.com/EgizianoEG/LAPD-Central-App/commit/44799b418ded4bc2aba60f33e2a2eec2e0053632)

- **Incident Log Improvements**  
  - Location field limit now enforced (max 80 chars).
  - Incident option/help adjusted for clarity.
  - Redundant error logging removed, reporting streamlined.  
    [6b90aed](https://github.com/EgizianoEG/LAPD-Central-App/commit/6b90aed3bd0b9ad368354ddd6f667b23cce652d0)

- **Duty & Log Command Descriptions**  
  - More direct, user-focused, and consistent subcommand explanations throughout duty/log commands.
  - Arrest/citation command descriptions now concise and clear.  
    [fc9444c](https://github.com/EgizianoEG/LAPD-Central-App/commit/fc9444ccc3faba447af54e86eeff6295b1d7e2c2)

- **Admin Shift Logging**  
  - Admin shift time tracking now respects/exposes `isNewShift` flag for better clarity and control in log/recording.
    [f2057f9](https://github.com/EgizianoEG/LAPD-Central-App/commit/f2057f98824547031e5bb3b23b3b4f92caa69825)

### Fixed

- **Config Command**  
  - Corrected config prompt message handling.
  - Enhanced type safety and action collector naming for error traceability.
  - State handling fixes for duty activities under config update-ensuring changes reflect consistently.  
    [5c4a6a9](https://github.com/EgizianoEG/LAPD-Central-App/commit/5c4a6a9dc5c045ca2d13af6387858682cad7a234), [e6f161b](https://github.com/EgizianoEG/LAPD-Central-App/commit/e6f161b872285252248d4f5cf85ec97fbf3c7c36), [1db367d](https://github.com/EgizianoEG/LAPD-Central-App/commit/1db367db0d4b8a707f8102d74bd5f948d5c10ea9), [fa23b0a](https://github.com/EgizianoEG/LAPD-Central-App/commit/fa23b0a261c3a40d35bbfe18eb9c5d4f58398c63)

- **Permission/Role Refactor**  
  - Hardcoded regex flags migrated to config/constants.  
    [b1d909b](https://github.com/EgizianoEG/LAPD-Central-App/commit/b1d909bb196bab37186272d5805fdbce0eead6ba)

- **Roblox Manual Verification Logic**  
  - Edge cases for empty Profile/About, attempt limits, and error messages are now more robust and user-friendly.  
    [78d1830](https://github.com/EgizianoEG/LAPD-Central-App/commit/78d183052bffd5e73d4bf6c737bf548b6c7feaeb)

- **Import Flow Username Resolve**  
  - Timeout for username resolve steps increased (from less than 60s to 60s), greatly improving import reliability on large jobs.  
    [0068779](https://github.com/EgizianoEG/LAPD-Central-App/commit/006877915c04015be3b670ab7a4232f702f508a3)

- **Saved Role Schema**  
  - Name field max length increased from 32 to 100, matching Discord role limits.  
    [42ec97c](https://github.com/EgizianoEG/LAPD-Central-App/commit/42ec97ce6cd771ec56e64cce5a5970d9127b03b8)

- **Username Lookup**  
  - Added username validation _before_ API calls for faster error responses.
  - Returns explicit "not found" for invalid usernames.
    [6caf4b8](https://github.com/EgizianoEG/LAPD-Central-App/commit/6caf4b8f468a6f827570e4f37cd163c419e99f86)

- **Database Consistency**  
  - Throw error (don't return null) for missing guild doc: ensures silent failures aren’t missed.
    [6aa2ffd](https://github.com/EgizianoEG/LAPD-Central-App/commit/6aa2ffd5ebb880d0880ce39d9e3362269e13dd91)

- **Typo Fix**  
  - Small typo in UpdateIncidentReport fixed.
    [3cfd569](https://github.com/EgizianoEG/LAPD-Central-App/commit/3cfd5697c1a823182a493eda0bdbc31d1ed7ddea)

- **Miscellaneous**  
  - Return type annotation on `VerifyGuilds`.
    [fa23b0a](https://github.com/EgizianoEG/LAPD-Central-App/commit/fa23b0a261c3a40d35bbfe18eb9c5d4f58398c63)
  - Logging for MongoDB connection now shows database name inline.
    [5515550](https://github.com/EgizianoEG/LAPD-Central-App/commit/55155501719f8f943902f907c8a2746cdab97554)

### Refactored

- **State, Types, and Node Compatibility**  
  - Better explicit `globalThis` use.
  - Null cron function now explicit in logic and types, preventing background task ambiguity.
    [ae2f64c](https://github.com/EgizianoEG/LAPD-Central-App/commit/ae2f64c0b49bfe0ebfb3dee97f725604a4effb20)

### Security

- **Vulnerability Patch**  
  - Updated `js-yaml` and other related package versions for known vulnerability.  
    [0ee7988](https://github.com/EgizianoEG/LAPD-Central-App/commit/0ee79884bd8bdbd3374ee692f316cedf79c56a8d)

### Full Changelog

[v1.9.2...v1.10.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.9.2...v1.10.0)

---

## [Version 1.9.2](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.9.2) – October 30, 2025

### Release Notes

Patch release improving shift reliability, interaction responsiveness, and admin callsign workflows; adds flexible division data to mugshots and updates dependencies. Several internal refactors enhance accuracy, maintainability, and logging clarity.

### Added

- **Mugshot Division Support and Callsign Lookup Utility:**  
  Mugshot generation now accepts an optional division name to better reflect unit context in images. A new database utility `GetActiveCallsign` was added to reliably retrieve an officer’s current callsign for downstream features.  
  [967a406](https://github.com/EgizianoEG/LAPD-Central-App/commit/967a406c024967606fd5b0be1b645140d75bd8db)

### Fixed

- **Accurate Active Shifts Retrieval and Tracking:**  
  Ensures only active shifts are returned by adding an explicit `end_timestamp` check. Expanded tracked shift flags to cover administrative and modified states for more precise handling. Simplified error logging and improved component disabling to avoid stale UI states.  
  [f961ea7](https://github.com/EgizianoEG/LAPD-Central-App/commit/f961ea7033366069eec532614c62d58aab59c960)

- **MongoDB Query for Tracked Shift Flags:**  
  Corrected the query syntax used in `ReloadActiveShiftsCache` to ensure tracked shift flags are accurately filtered and cached.  
  [74e50b5](https://github.com/EgizianoEG/LAPD-Central-App/commit/74e50b5a0fa6ba2050704682cd01d2455f5c1b5b)

- **Callsign Admin Actions Error Handling and UX:**  
  Replaced `Promise.allSettled` with sequential error replies and callbacks to prevent race conditions. Interactions are now acknowledged immediately, and errors are surfaced without delay. Also removed an unnecessary date argument from admin data fetching for simplicity.  
  [d9dd064](https://github.com/EgizianoEG/LAPD-Central-App/commit/d9dd0647ffad68cae0d1c199459cbc1fd3f87451)

- **Shift Management Interaction Timing:**  
  Defers interactions when not already deferred/replied to, and standardizes updates via `editReply` to reduce timeouts during prompt updates.  
  [b3bfd61](https://github.com/EgizianoEG/LAPD-Central-App/commit/b3bfd6112b7f6ab7faa7fcd9e2f9d66849f80aba)

- **Duty Admin Success Flow:**  
  Sends success feedback immediately after shift deletion, moving logging and follow-ups to async execution to avoid conflicts and improve responsiveness.  
  [b28d13e](https://github.com/EgizianoEG/LAPD-Central-App/commit/b28d13ec2c97411eda88f24edcbca23e738088cf)

- **Autocomplete Height Results Limit:**  
  Capped height autocomplete suggestions to 25 results to comply with Discord limits and prevent invalid form submissions.  
  [b881c60](https://github.com/EgizianoEG/LAPD-Central-App/commit/b881c601e92f99afa83fcd5a59d442b1a48c8bb6)

- **Guild Settings Return Type Handling:**  
  Ensured `GetGuildSettings` correctly returns the expected document/object shape, preventing type inconsistencies in consumers.  
  [7af13c6](https://github.com/EgizianoEG/LAPD-Central-App/commit/7af13c65994b5ffb9955f3fa549108020f91982d)

- **Callsign Schema Requirement Fix:**  
  Corrected a date field requirement from true to false to prevent invalid document failures during edge-case operations.  
  [08601c9](https://github.com/EgizianoEG/LAPD-Central-App/commit/08601c9c6801fcbfc4dae7857b3905c50fc570e9)

### Changed

- **Dependency Upgrades (discord.js and Related Packages):**  
  Upgraded `discord.js` (14.23.2 → 14.24.1), `@discordjs/builders` (1.12.1 → 1.13.0), and `discord-api-types` (0.38.29 → 0.38.31) to stay current with API improvements and bug fixes.  
  [c1a8271](https://github.com/EgizianoEG/LAPD-Central-App/commit/c1a8271580a07680fba7d30d05a7ad030a19d9a7)

- **Approval Messages Formatting:**  
  Adjusted newline escaping for leave-of-absence/reduced-activity approval messages for cleaner output.  
  [9974af5](https://github.com/EgizianoEG/LAPD-Central-App/commit/9974af58d351a2b79e1392f9dca3ffe8e0515682)

### Refactored

- **Admin Callsign Query Accuracy:**  
  Enhanced admin callsign queries to leverage the expiry notification flag and use millisecond-range filtering for expired/inactive lookups, improving data accuracy.  
  [55b5011](https://github.com/EgizianoEG/LAPD-Central-App/commit/55b50112708f78d33fd2fdf243c5c86dd4d4d081)

- **Shift Action Logger Clarity:**  
  Removed a redundant break-time assertion and introduced an `IsNewShift` parameter to `LogShiftTimeAddSub`, making action differentiation explicit and logs clearer.  
  [4b89bf1](https://github.com/EgizianoEG/LAPD-Central-App/commit/4b89bf17ed1f532d0418a390443b526cb64cf3e7)

### Full Changelog

[v1.9.1...v1.9.2](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.9.1...v1.9.2)

---

## [Version 1.9.1](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.9.1) – October 17, 2025

### Release Notes

Minor patch focusing on data integrity for shift durations and improved type safety/consistency in guild settings retrieval, with small internal refinements.

### Fixed

- **Accurate Shift Duration Recalculation:**  
  Recompute on-duty and break totals directly from timestamps to eliminate stale or inconsistent precomputed fields. This ensures shift summaries and analytics reflect the true recorded times.  
  [9129b41](https://github.com/EgizianoEG/LAPD-Central-App/commit/9129b4139d9903a6af61d3dbe554f95dc05f2e73)

- **Guild Settings ObjectId Consistency:**  
  Addressed related linting issues.  
  [c61f2bf](https://github.com/EgizianoEG/LAPD-Central-App/commit/c61f2bf437dac9524fab56df9ec3c81857190886)

### Changed

- **Lean Query Simplification and Typing Clarity:**  
  Removed unnecessary `mongoose.exec()` on lean queries and added explicit return types for async DB fetchers. Improves readability, predictability, and alignment with TypeScript expectations.  
  [c61f2bf](https://github.com/EgizianoEG/LAPD-Central-App/commit/c61f2bf437dac9524fab56df9ec3c81857190886)

### Refactored

- **Manual Shift Time Edits Visibility:**  
  Flag manual time changes with a “Modified” indicator and update admin summaries to surface adjustments clearly, aiding auditability and review.  
  [9129b41](https://github.com/EgizianoEG/LAPD-Central-App/commit/9129b4139d9903a6af61d3dbe554f95dc05f2e73)

- **Schema Option Safety:**  
  Marked schema option object as readonly to enforce immutability and strengthen type safety.  
  [c61f2bf](https://github.com/EgizianoEG/LAPD-Central-App/commit/c61f2bf437dac9524fab56df9ec3c81857190886)

### Full Changelog

[v1.9.0...v1.9.1](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.9.0...v1.9.1)

---

## [Version 1.9.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.9.0) – October 17, 2025

### Release Notes

Significant update adding bulk call sign data management, optional auto-release for inactive call signs, improved embeds with guild links, modernization of workflows, and extensive refactors and fixes for performance, clarity, and maintainability.

### Added

- **Bulk Call Sign Data Management (Wipe and Release):**  
  Introduced a new server data management module to perform bulk operations on call sign records. Administrators can filter by designation (division beats, unit types, beat numbers) and status (pending, approved, active, expired, cancelled), preview the impact with confirmation prompts, and execute destructive actions safely. Bulk release preserves history, updates nicknames automatically, and provides comprehensive audit logging with progress indicators and feedback.  
  [7870307](https://github.com/EgizianoEG/LAPD-Central-App/commit/78703073249accaf58d3757930871cb644295758)

- **Auto-Release of Inactive Call Signs:**  
  Added an optional auto-release system for inactive call signs with a 12-hour grace period. Releases are scheduled when a member leaves or loses staff permissions and cancelled if staff status is regained. The processor is unified for both expiries and auto-releases (7-day window), with user DMs and detailed logs. Config UI labels and layout updated accordingly.  
  [2da4955](https://github.com/EgizianoEG/LAPD-Central-App/commit/2da49553a52c53622b92e869558205b389a8f894)

- **Clickable Guild URLs in DM Notices:**  
  Added a ChannelLink helper and updated embed authors for callsign and user activity notice loggers to include guild URLs, enabling direct navigation from notifications.  
  [ce6837c](https://github.com/EgizianoEG/LAPD-Central-App/commit/ce6837c3415c8995698a713f171c00685d98c8c7)

- **Copilot Coding Agent Onboarding Instructions:**  
  Added a comprehensive .github/copilot-instructions.md to streamline setup, build, testing, and contribution workflows for the Copilot coding agent.  
  [3d1271d](https://github.com/EgizianoEG/LAPD-Central-App/commit/3d1271d043833d6eefd447f4543944dcfe28255f) (PR [#91](https://github.com/EgizianoEG/LAPD-Central-App/pull/91))

### Fixed

- **Role Persistence Hierarchy Safeguard:**  
  Added a permission check to ensure role persistence operations respect the invoking user's role hierarchy, preventing unauthorized or failing updates.  
  [eb4dcaa](https://github.com/EgizianoEG/LAPD-Central-App/commit/eb4dcaa437c7816e7f70fe40e7bb58c5f83b1508)

- **Autocomplete Suggestion Length:**  
  Corrected weight suggestion length in autocomplete to comply with Discord constraints and avoid invalid option payloads.  
  [957d252](https://github.com/EgizianoEG/LAPD-Central-App/commit/957d252928f97d26c2605099fbcc3b97a1758503)

- **Duty Admin Data Freshness After Deletion:**  
  Ensured active shift datasets are refreshed after deletions with a short delay to avoid stale views and inconsistencies.  
  [4768867](https://github.com/EgizianoEG/LAPD-Central-App/commit/476886784431ead5e3c138f1ad1d7012e0b4b68c)

- **Server Data Management Minor Issues:**  
  Addressed minor issues in server data management flows to improve reliability and user feedback.  
  [8d720db](https://github.com/EgizianoEG/LAPD-Central-App/commit/8d720db3a43698f2f5b97202c6f7febdf70be7f0)

- **UAN Deletion Filter Edge Cases:**  
  Fixed bugs affecting combination filters for UAN deletion (after/before date with status) as part of the module separation work.  
  [9e9989a](https://github.com/EgizianoEG/LAPD-Central-App/commit/9e9989a12422ae51f6d8fc552d8a22d0c956ec59)

### Changed

- **Dependency Upgrades (Core Libraries):**  
  Upgraded dedent, mongoose, and winston to their latest versions for better performance, stability, and compatibility.  
  [e2768c6](https://github.com/EgizianoEG/LAPD-Central-App/commit/e2768c65f20a8e6ed249f821fa347b8ae161c0fa)

- **CI/Workflows Updates:**  
  Updated Node.js to v24 in RunTests.yml and attempted a fix for a Labeler.yml warning to keep CI green and current.  
  [d24f28d](https://github.com/EgizianoEG/LAPD-Central-App/commit/d24f28d0a0c736c3d8664d0064bc6bf9bfa81583)

- **Git Ignore Enhancements:**  
  Added ignore entry for app commands under the Development directory to reduce noise and prevent accidental commits.  
  [f80adf8](https://github.com/EgizianoEG/LAPD-Central-App/commit/f80adf8b886c4199ec9da8cbaed9fa6ac0e54956)

- **UI Copy and Clarity Improvements:**  
  Updated placeholder examples and improved button labels/descriptions in server data management to enhance usability and clarity.  
  [e404049](https://github.com/EgizianoEG/LAPD-Central-App/commit/e4040490ae113eae4bc093fda26b7b6f8aadf6a5), [4401ffb](https://github.com/EgizianoEG/LAPD-Central-App/commit/4401ffbaa25311568665049e26b31079035893bb)

### Deprecated

- No deprecations in this release.

### Removed

- **Unused Development Commands:**  
  Removed obsolete development commands as part of ongoing cleanup and maintenance.  
  [939a162](https://github.com/EgizianoEG/LAPD-Central-App/commit/939a162a093ee195d6f406922674072029599e2e)

- **VS Code Recommendation Cleanup:**  
  Removed the unused Babel language extension from VS Code recommendations.  
  [c30de6d](https://github.com/EgizianoEG/LAPD-Central-App/commit/c30de6d5546bf75f1f695e9d1ee52b355a9400f2)

### Security

- No security-related changes in this release.

### Refactored

- **Core Performance and Reliability Pass:**  
  Broad refactor replacing many array forEach/includes with for..of and Set.has, adopting String.replaceAll for global replacements, standardizing ephemeral response disabling and collection usage in interactions, defaulting to Promise.resolve in async returns, improving error handling with clearer stack traces, enforcing consistent command object casing, and streamlining regex usage across the codebase.  
  [dac388f](https://github.com/EgizianoEG/LAPD-Central-App/commit/dac388f28a86dcdf0a8649c3456895fb9eaf92c9)

- **Numeric Utilities Modernization:**  
  Replaced global parseInt/parseFloat/isNaN with Number.parseInt/Number.parseFloat/Number.isNaN across commands, utilities, models, and integrations to avoid coercion pitfalls and align with modern JS best practices.  
  [bcfe00d](https://github.com/EgizianoEG/LAPD-Central-App/commit/bcfe00da05b54ce96d2ac8d2519e4b6972337089)

- **Autodelete Loop Efficiency:**  
  Replaced forEach with a standard for loop in autodelete routines for minor performance and readability gains.  
  [93b5a1f](https://github.com/EgizianoEG/LAPD-Central-App/commit/93b5a1f59b4ac992903a5b0f8c285fa018e76597)

- **Logger Memory Reporting Simplification:**  
  Rounded memory usage values and simplified AddMemorySnapshot inclusion logic for cleaner, more readable logs.  
  [cdb88a2](https://github.com/EgizianoEG/LAPD-Central-App/commit/cdb88a2aeaaff285632cf3b5b4b5400d837da223), [59e919a](https://github.com/EgizianoEG/LAPD-Central-App/commit/59e919a9c0f550477ead214801d1c73d34851cf2)

- **Server Data Management Modularization:**  
  Split the monolithic management logic (~1600 LOC) into separate modules for Shifts and UAN, exported reusable helpers, standardized UI containers (InfoContainer/ErrorContainer), improved logging with error objects, and fixed edge-case bugs in UAN deletion filters. Reduced main file to ~250 lines for maintainability.  
  [9e9989a](https://github.com/EgizianoEG/LAPD-Central-App/commit/9e9989a12422ae51f6d8fc552d8a22d0c956ec59)

- **Input Prompt Improvements:**  
  Refined input prompts and descriptions for date and shift management, improving guidance and reducing input errors.  
  [d4fddbc](https://github.com/EgizianoEG/LAPD-Central-App/commit/d4fddbcc44998e216e66e137c2d0fc2877190749)

- **Event and Handler Naming Clarity:**  
  Renamed RolePersist handler to better reflect its purpose and updated the shift termination handler/file names and logs for clarity and consistency.  
  [c960c40](https://github.com/EgizianoEG/LAPD-Central-App/commit/c960c40b1bba1b4ccb836f49376621f5a97fa4d5), [06d67b6](https://github.com/EgizianoEG/LAPD-Central-App/commit/06d67b6dae221adf114d3483a6f76d78745175f0)

- **Mongoose and Path Utilities Cleanup:**  
  Switched to a destructured FilterQuery import for brevity and replaced a custom GetDirName helper with built-in import.meta.dirname for path resolution.  
  [6be17e0](https://github.com/EgizianoEG/LAPD-Central-App/commit/6be17e0de2a73bbdf49315c6e3c7e2ca96bafa6c), [897d8c6](https://github.com/EgizianoEG/LAPD-Central-App/commit/897d8c6b252d369db857ffe551bf7357a5c6acfa)

- **Formatting and Housekeeping:**  
  Ensured Prettier newline-at-EOF and removed an outdated cognitive complexity comment.  
  [6d6380a](https://github.com/EgizianoEG/LAPD-Central-App/commit/6d6380a79ec354b665cb7fdaafc9bb72b60193b2), [61f6bd9](https://github.com/EgizianoEG/LAPD-Central-App/commit/61f6bd99d9df18d1545e02af69c171a05fe2a1ad)

### Pull Requests

- [#91](https://github.com/EgizianoEG/LAPD-Central-App/pull/91) feat: add comprehensive .github/copilot-instructions.md to onboard Copilot coding agent — by [@Copilot](https://github.com/Copilot)

### Full Changelog

[v1.8.1...v1.9.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.8.1...v1.9.0)

---

## [Version 1.8.1](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.8.1) – October 13, 2025

### Release Notes

Minor patch release with improved monitoring and resolved nickname prefix conflicts for leave of absence notices.

### Added

- **Memory Snapshot in Logger:**  
  Logger entries now include a memory snapshot, enabling better monitoring and diagnostics of application resource usage.  
  [9ac9980](https://github.com/EgizianoEG/LAPD-Central-App/commit/9ac99803cf046bdf4a8faeb9d41c306b82e51db6)

### Fixed

- **Leave of Absence vs. Reduced Activity Prefix Conflict:**  
  Improved nickname management for leave of absence notices. The system now removes any existing reduced activity prefix before applying the leave of absence prefix, ensuring proper precedence and avoiding conflicting or duplicated prefixes. Handles both trimmed and non-trimmed prefix variations.  
  [e050ebe](https://github.com/EgizianoEG/LAPD-Central-App/commit/e050ebefb52d2bdd09c8d3a2c6830080088da8b7)

### Refactored

- **Error Handler Improvements:**  
  Enhanced error handling with improved categorization (network errors, non-fatal errors), async support for unhandled promise rejections, and more informative error messages. Extracted classification logic into helpers, added process termination delay configuration, and improved documentation throughout.  
  [f12ea87](https://github.com/EgizianoEG/LAPD-Central-App/commit/f12ea871308d7a66dca0277c5dae2b8cfecd329c)

### Full Changelog  

[v1.8.0...v1.8.1](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.8.0...v1.8.1)

---

## [Version 1.8.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.8.0) – October 10, 2025

### Release Notes

A substantial update introducing fully functional call sign restrictions configuration, UI modernization for modals, and several quality-of-life fixes and improvements.

### Added

- **Complete Call Sign Restrictions Configuration UI:**  
  Fully implemented modal-based UI for adding, removing, and managing both unit type and beat number restrictions in the call sign module. This includes functional restriction management components, support for bulk operations, enhanced forms with new LabelBuilder components, improved input validation, nickname format sanitization, and updated documentation.  
  [6abbae1](https://github.com/EgizianoEG/LAPD-Central-App/commit/6abbae115a1b80478da600cbff5d275cee1fdcb0)

- **Reviewer Notes in DM Approval Notices:**  
  Direct messages for call sign approval now include reviewer notes, ensuring consistency with denial notices and providing better feedback to users.  
  [b9028d6](https://github.com/EgizianoEG/LAPD-Central-App/commit/b9028d633cfcfe6aaa5bec6d39466d8ea0396c13)

### Changed

- **Modernized Modal Components:**  
  Refactored all modal components to use the LabelBuilder pattern for improved UI consistency, clearer field descriptions, and better accessibility. Modal construction patterns are now standardized across incident reports, duty management, and other features.  
  [389e4d0](https://github.com/EgizianoEG/LAPD-Central-App/commit/389e4d04460ee6e371e935001d4fbdbd3976457c), [e806135](https://github.com/EgizianoEG/LAPD-Central-App/commit/e8061351310802f5e6f68b99a1a7d98fd33166cc)

- **Text Input Field Extraction:**  
  Extracted text input fields from inline creation to separate variables in configuration modals, improving code reusability and readability.  
  [e806135](https://github.com/EgizianoEG/LAPD-Central-App/commit/e8061351310802f5e6f68b99a1a7d98fd33166cc)

- **Updated Default Nickname Format:**  
  The default nickname format for new guilds now includes the beat number, providing more clarity and consistency.  
  [59ee3f7](https://github.com/EgizianoEG/LAPD-Central-App/commit/59ee3f76aff65bfa2805137f33fc43bf21d1a2c1)

- **Dependency Upgrades:**  
  Updated `discord.js` to version 14.23.2 for improved performance, compatibility, and to support latest features.  
  [12c6e59](https://github.com/EgizianoEG/LAPD-Central-App/commit/12c6e592df5a4248f0935efa0e7548c59ec9b66a)

### Fixed

- **Call Sign Status Update Permission Check:**  
  Updated permission logic in `HandleCallsignStatusUpdates` to respect administrator role permissions by passing a `true` flag for the checkAdmin argument.  
  [ba918a5](https://github.com/EgizianoEG/LAPD-Central-App/commit/ba918a5fb2c6ccb3a17ed62e6c580bc6bcbc1caa)

- **GetGuildSettings Model Conversion:**  
  Improved document retrieval logic and ensured conversion to proper object types in `GetGuildSettings` to prevent errors.  
  [569d27f](https://github.com/EgizianoEG/LAPD-Central-App/commit/569d27fabb4604dfc787d9b7d3f0266459e1e438)

- **Interaction Reply Handling:**  
  Improved reply handling in command callbacks to ensure more robust interaction responses.  
  [a7d16b0](https://github.com/EgizianoEG/LAPD-Central-App/commit/a7d16b067c7d476f4246330e07f1619800f32fc3)

### Removed

- **Development Command Cleanup:**  
  Removed the Components V2 message development command as part of codebase cleanup.  
  [e70467a](https://github.com/EgizianoEG/LAPD-Central-App/commit/e70467a39d58594e517826c6d559edabcb8b8d37)

### Full Changelog  

[v1.7.2...v1.8.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.7.2...v1.8.0)

---

## [Version 1.7.2](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.7.2) – October 7, 2025

### Release Notes

Minor patch release focusing on bug fixes, improved error handling, and consistency enhancements for the call sign module and reporting features.

### Fixed

- **Call Sign Listing Display:**  
  Fixed code block scoping and indentation issues in the call sign listing functionality, resolving duplicate entries and preventing Discord invalid form responses.  
  [9252365](https://github.com/EgizianoEG/LAPD-Central-App/commit/9252365c9d4eabc24ebee286e3ecb65d15f11ebc)

- **Officer Report Output:**  
  Ensured there is no unnecessary newline between each data field in officer reports, improving output formatting.  
  [f218c6e](https://github.com/EgizianoEG/LAPD-Central-App/commit/f218c6e706875b7835266990ff183605e4055090)

- **Import Path Correction:**  
  Corrected the path of an imported function to ensure proper module resolution.  
  [979419c](https://github.com/EgizianoEG/LAPD-Central-App/commit/979419c40ba5961d99eec89e9a3a1deec9336445)

### Refactored

- **Call Sign Management Handler Responses:**  
  Replaced `EmbedBuilder` instances with specialized container classes (`SuccessContainer`, `ErrorContainer`, `WarnContainer`) for unified response styling. Response handling updated to use components arrays and include the `MessageFlags.IsComponentsV2` flag. Improved async member fetching and standardized error messaging with templates.  
  [6483348](https://github.com/EgizianoEG/LAPD-Central-App/commit/64833489d3abb7816996c7a99c920392a2f11a40)

- **Minor App Config Renaming:**  
  Performed minor renaming in application configuration for clarity.  
  [901a57d](https://github.com/EgizianoEG/LAPD-Central-App/commit/901a57d8c292aded480dc16beb0b75d12c398a24)

### Full Changelog  

[v1.7.1...v1.7.2](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.7.1...v1.7.2)

---

## [Version 1.7.1](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.7.1) – October 5, 2025

### Release Notes

Minor patch release addressing call sign module stability, interaction timeout handling, and configuration error management.

### Fixed

- **Interaction Timeout Handling in Configuration:**  
  Simplified error handling by directly passing error objects in config functions and improved handling of timed-out interaction updates to prevent unknown interaction errors.  
  [cb23b15](https://github.com/EgizianoEG/LAPD-Central-App/commit/cb23b154f82013fe2bd1f99ad75b18c1c34f2a40)

- **Service Unit Type Indicator Length:**  
  Updated restricted service unit type indicator to be shorter and respect Discord's label description maximum character limit, preventing truncation issues.  
  [27936c5](https://github.com/EgizianoEG/LAPD-Central-App/commit/27936c539361e6a8a57f547ae76fd11a56ce81cf)

- **Call Sign Status Update Permissions:**  
  Ensured only manageable members are processed in HandleCallsignStatusUpdates to prevent permission errors when attempting to update nicknames for members with higher roles.  
  [eb02f5f](https://github.com/EgizianoEG/LAPD-Central-App/commit/eb02f5f831ed37eb796d1b0e20ce4326f16b8554)

### Full Changelog

[v1.7.0...v1.7.1](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.7.0...v1.7.1)

---

## [Version 1.7.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.7.0) – October 5, 2025

### Release Notes

Major update introducing a comprehensive callsigns management system, enhanced Roblox API integration with fallback mechanisms, improved shift management reliability, and numerous bug fixes for better overall stability.

### Added

- **Complete Callsigns Module System:**  
  Introduced a comprehensive callsigns (call signs) management system supporting request workflows, administrative controls, and automated lifecycle management. Features include request submission with validation, approval/denial workflows, administrative assignment and release, callsign transfers, expiry handling with automated notifications, role-based restrictions for unit types and beat numbers, configurable nickname formatting with automatic updates, and paginated listing with detailed views. Extensive database schema additions, event logging, autocomplete enhancements, and configuration UI updates support the full feature set.  
  [45ce0cb](https://github.com/EgizianoEG/LAPD-Central-App/commit/45ce0cb1f441e5e6c9f179e5fd3f3fe4a6f149b3)

- **Roblox Open Cloud API v2 Integration:**  
  Added support for Roblox Open Cloud API v2 as the primary data source for user information retrieval, with automatic fallback to legacy noblox.js API for enhanced reliability during outages or rate limiting. Includes profile redirect fallback method for user ID lookup when APIs are unavailable, comprehensive error handling, and result caching for improved performance.  
  [ce00092](https://github.com/EgizianoEG/LAPD-Central-App/commit/ce0009213f77499b0e65d5268e3037d3608f3ec8), [bd7df14](https://github.com/EgizianoEG/LAPD-Central-App/commit/bd7df1474682522dbba1f005a91c9ef5f91b495e), [4ba4d34](https://github.com/EgizianoEG/LAPD-Central-App/commit/4ba4d34520aee8ffee755ad8bdecbc05e3222644)

- **Roblox OmniSearch Integration:**  
  Implemented Roblox OmniSearch API for enhanced username queries with reduced rate limiting, supporting pagination and session tracking for improved search performance. Cache TTL adjusted to 2.5 minutes for fresher results.  
  [0ba4aaa](https://github.com/EgizianoEG/LAPD-Central-App/commit/0ba4aaad98cd2c224975a939cc5ec02eab1182ab)

- **Shift Type Filter for Activity Queries:**  
  Added optional shift-type filter to officer activity command, enabling filtering by specific shift types with autocomplete support for better data analysis.  
  [85c8435](https://github.com/EgizianoEG/LAPD-Central-App/commit/85c84356240eb644757d77a0ae21e89ab2d3261d)

- **WebP Image Format Support:**  
  Extended incident attachment validation to accept WebP images alongside PNG, JPG, and JPEG formats, addressing Discord's automatic conversion to WebP.  
  [2f61841](https://github.com/EgizianoEG/LAPD-Central-App/commit/2f6184118aab57b7fb5a004de64d883d5087fbf6)

- **Heroku Deployment Support:**  
  Added Heroku prebuild script and Procfile for streamlined cloud deployment.  
  [4d8c700](https://github.com/EgizianoEG/LAPD-Central-App/commit/4d8c7009d90c7ba615324c67e58ab56847fea74e)

- **Enhanced Username Autocomplete:**  
  Updated username autocomplete to use `ApplicationCommandOptionChoiceData` with optional `ValueAsEnclosedId` parameter for reduced lookup overhead in future implementations.  
  [754aa1a](https://github.com/EgizianoEG/LAPD-Central-App/commit/754aa1ae5ae2b4015cbb6cecbc855f0cf3fb1c60)

### Changed

- **Import Path Standardization:**  
  Standardized all import paths using new `@Source/*` path alias after deprecation of `baseUrl` tsconfig field, improving consistency and maintainability. Updated Discord.js event handling to use Events enum instead of string event names for better type safety. Renamed Ready event handlers directory to ClientReady for deprecation compliance. Upgraded discord.js from 14.21.0 to 14.22.1 with updated dependencies.  
  [b77d80b](https://github.com/EgizianoEG/LAPD-Central-App/commit/b77d80b285fb2b3ec4e43f81d64e20649dd6d9a1), [c2148fd](https://github.com/EgizianoEG/LAPD-Central-App/commit/c2148fdc095ec8fec9536b282b968233ef832cab)

- **Shift Duration Calculation Improvements:**  
  Refactored shift duration calculation to eliminate side effects from virtual methods, ensure proper inclusion of `on_duty_mod` in calculations, and replace static duration references with dynamic calculation functions for improved accuracy and reliability.  
  [1b2086c](https://github.com/EgizianoEG/LAPD-Central-App/commit/1b2086c5176d6c2d774c6d537ef74b3166b33f03)

- **Duty Admin Duration Limits:**  
  Updated maximum shift duration from 1 month to 14 days for shift creation and time setting operations, improving data consistency.  
  [8257f6b](https://github.com/EgizianoEG/LAPD-Central-App/commit/8257f6b18ab9ac2c3e848e3f0385b159b2787351)

- **TypeScript Configuration Updates:**  
  Updated `module` and `moduleResolution` to `nodenext` for improved compatibility, and removed deprecated `baseUrl` option from tsconfig.  
  [b350d81](https://github.com/EgizianoEG/LAPD-Central-App/commit/b350d81f58c10a97d22b20a6630075f9c60577ef)

- **Dependency Upgrades:**  
  Upgraded jest from 29.7.0 to 30.2.0 with ts-jest update to 29.4.4, @faker-js/faker from 9.6.0 to 10.0.0, and axios from 1.11.0 to 1.12.0 for improved performance, security, and compatibility.  
  [0130dec](https://github.com/EgizianoEG/LAPD-Central-App/commit/0130deca5bc834f6c634b40bc4c970c70aa5b889), [42be53c](https://github.com/EgizianoEG/LAPD-Central-App/commit/42be53c4d75653588a7c7abe45015d97c9858efe), [8ce8201](https://github.com/EgizianoEG/LAPD-Central-App/commit/8ce820143c3eaa1f0943e0012d6f58e76f8ee61b)

- **Enhanced Duty Logs Cleanup Logging:**  
  Improved logging for duty logs cleanup to conditionally log only when deletions occur, reducing unnecessary log noise.  
  [d377549](https://github.com/EgizianoEG/LAPD-Central-App/commit/d3775492036311f0b09f2b5a5b645039219de449)

- **Shift Type Autocomplete Sorting:**  
  Updated shift type sorting logic to use `created_on` timestamp instead of locale-based sorting for more reliable ordering.  
  [48a2e73](https://github.com/EgizianoEG/LAPD-Central-App/commit/48a2e73243d87ccc129d06827d5417172a632544)

- **Active Shifts Display:**  
  Updated active shifts display to reflect listed shifts instead of total shifts for more accurate counts, and adjusted text styling to conditionally show shift count only when relevant.  
  [4ba4d34](https://github.com/EgizianoEG/LAPD-Central-App/commit/4ba4d34520aee8ffee755ad8bdecbc05e3222644), [49ea374](https://github.com/EgizianoEG/LAPD-Central-App/commit/49ea3747da44d94c65e810e847239bbfce0b212e)

### Fixed

- **Interaction Webhook Timeout Handling:**  
  Added timeout check for interactions older than 14.9 minutes to prevent Discord API "unknown interaction" errors. Return types updated to include null for expired interactions with improved error handling.  
  [e98df2c](https://github.com/EgizianoEG/LAPD-Central-App/commit/e98df2cc58d76a592bab89baa2ff3f42636d4bf1)

- **Shift Management Reliability:**  
  Fixed shift deletion validation by replacing active shift retrieval method and ensuring proper handling of ongoing shifts during void operations. Added checks for acknowledged and successful deletion of shift records. Removed ActiveShiftsStream change stream pre-matching that prevented receiving delete operations and caused inconsistencies.  
  [4dce6c4](https://github.com/EgizianoEG/LAPD-Central-App/commit/4dce6c4be2ecb3bad19bc3e4579430030716bbbe), [68ce6f9](https://github.com/EgizianoEG/LAPD-Central-App/commit/68ce6f9a2e301eb7212266c5e2c36ee67e7dd0f7), [704266c](https://github.com/EgizianoEG/LAPD-Central-App/commit/704266c2bd61008e04b0cbb868d92fc3741deb5a)

- **On-Duty Role Assignment:**  
  Ensured proper removal of on-duty roles when members go on break status with improved error handling.  
  [ac31e6a](https://github.com/EgizianoEG/LAPD-Central-App/commit/ac31e6a624a8d825172cad09c0ed46a02c617bb4)

- **Mongoose Schema Validation:**  
  Fixed String type required fields validation in Mongoose schemas to allow passing empty strings, and added required validation for boolean fields in CitationSchema.  
  [c49ef6f](https://github.com/EgizianoEG/LAPD-Central-App/commit/c49ef6fe2779795217d69bc524fc16f6660c9dba), [512ff83](https://github.com/EgizianoEG/LAPD-Central-App/commit/512ff8376faf3695aba6fc875fd764fff7ab68fa)

- **Shift Import Validation:**  
  Enhanced duty import with file size and content limits, fetch timeout, improved error handling, username validation, entry deduplication, and unique timestamping to prevent processing issues and ensure data integrity. Improved shift entry generation with unique IDs and better randomness.  
  [a9c628e](https://github.com/EgizianoEG/LAPD-Central-App/commit/a9c628e4ebcc75af430200b405a10cb3893d50de), [276b4d5](https://github.com/EgizianoEG/LAPD-Central-App/commit/276b4d57ff2610515cd009c6dafc09dbbfbb272b)

- **Username Validation Improvements:**  
  Added warning when Discord username is entered instead of Roblox username to prevent user confusion, and added null check for AboutText to prevent undefined access errors during manual verification.  
  [3d3ba0a](https://github.com/EgizianoEG/LAPD-Central-App/commit/3d3ba0aa74a060db790519820c5e1cd8da6d01e6)

- **Role Persistence Logic:**  
  Adjusted join timestamp threshold to 60 seconds for broader accuracy and included screening completion in recent join condition evaluation for improved reliability.  
  [5a52de4](https://github.com/EgizianoEG/LAPD-Central-App/commit/5a52de4614218dc93dabea8c20425ce35c4c6117)

- **UAN Listing Sorting:**  
  Added missing sort parameter to UANModel.find() for proper data ordering (active records sorted by end_date ascending, non-active by request_date ascending).  
  [d596d0d](https://github.com/EgizianoEG/LAPD-Central-App/commit/d596d0d3fd58652c0a8444830fcfa14cb7e200a0)

- **Shift Type Deletion Status:**  
  Fixed shift type deletion inconsistency by adding error handling for failed deletions with user-friendly messaging and improved timeout response title formatting.  
  [0a69119](https://github.com/EgizianoEG/LAPD-Central-App/commit/0a69119b3de76805fe5527114abe1f73fdb129da)

- **Shift Time Label:**  
  Updated shift management embed to display "Shift Started" label for clarity.  
  [0c1622f](https://github.com/EgizianoEG/LAPD-Central-App/commit/0c1622f0874fa3aed6d15093db25a50586f4ea56)

- **Error Handler Enhancement:**  
  Included AxiosError in the list of non-fatal error types for better error classification.  
  [5fe2ff3](https://github.com/EgizianoEG/LAPD-Central-App/commit/5fe2ff3a063b460f86e829f72e8263f7ce475fed)

- **Pagination Validation:**  
  Added validation to HandlePagePagination to ensure 'pages' array is not empty, preventing runtime errors.  
  [eff8d2c](https://github.com/EgizianoEG/LAPD-Central-App/commit/eff8d2c89ba1f1f13849487204192d70e5ff72e0)

- **Minor UI/UX Fixes:**  
  Removed unnecessary label from button accessory in role list functions, updated autocomplete default suggestion positioning, fixed ended timestamp display in shift listing, corrected frequent shift display logic for filtered queries, removed bold formatting from active shifts description, and updated OmniSearch topicId value.  
  [7a3f5f7](https://github.com/EgizianoEG/LAPD-Central-App/commit/7a3f5f7dd18b3f53ec6b9bbc6235bc1ab8054035), [50198a6](https://github.com/EgizianoEG/LAPD-Central-App/commit/50198a643f62c06fd6f43e7fc3ad652afee48939), [df23f2c](https://github.com/EgizianoEG/LAPD-Central-App/commit/df23f2c41e87ed75bb639fb9e4e62d2d343a5200), [c5930a9](https://github.com/EgizianoEG/LAPD-Central-App/commit/c5930a97c048822258d1e06dce8f19a7769ea453), [512e2d8](https://github.com/EgizianoEG/LAPD-Central-App/commit/512e2d8202b43086d7f9dc71171a1be44fb2825c)

### Refactored

- **Shift Wipe Aggregation:**  
  Updated WipeUserShifts aggregation to correctly calculate total shift time by relying on shift count instead of duration calculation for improved accuracy.  
  [0fd5819](https://github.com/EgizianoEG/LAPD-Central-App/commit/0fd5819e6b09965a8a6e732d775dd940546eef16)

- **Error Logging Improvements:**  
  Simplified error logging by removing unnecessary object spread in shift management and including error objects in logging calls.  
  [b6760bc](https://github.com/EgizianoEG/LAPD-Central-App/commit/b6760bc8787853687dd1358f56aec1e960c9e3d1), [5df43d4](https://github.com/EgizianoEG/LAPD-Central-App/commit/5df43d430556c2bb5a4219b94108489a4f66f38b)

- **Roblox Query Logging:**  
  Removed redundant repeated logs from GetIdByUsername function for cleaner output.  
  [dcc0498](https://github.com/EgizianoEG/LAPD-Central-App/commit/dcc04986176845f3045431e9eb4fcacac461e936)

- **UAN Early Returns:**  
  Added early return for empty NoticesHandled in CheckForExpiredUANotices for improved performance.  
  [2aea30d](https://github.com/EgizianoEG/LAPD-Central-App/commit/2aea30dc5083b455b0a77a5394dede7c717ee6f8)

- **Nickname Replacement Logic:**  
  Adjusted batch processing logic and enhanced replacement string handling in nickname operations.  
  [303b2a7](https://github.com/EgizianoEG/LAPD-Central-App/commit/303b2a73cd4f4ae162b6358ffcbe34f07bdde626)

- **UI Text Styling:**  
  Removed unnecessary asterisks from field names in officer callback response and updated error message terminology for consistency.  
  [dcb1d83](https://github.com/EgizianoEG/LAPD-Central-App/commit/dcb1d8352812371ec19712342b9dba91b91edc8e), [825599e](https://github.com/EgizianoEG/LAPD-Central-App/commit/825599ef03858bd83690a531be38e01751960796)

### Tests

- **Mock Interaction Fixes:**  
  Fixed createdAt missing for mock interactions in extra-components tests.  
  [9581af3](https://github.com/EgizianoEG/LAPD-Central-App/commit/9581af3b340bd6e12ff198d7eb54a4d2d57fce94)

### Migration Notes

- **Callsigns Module Database Changes:**  
  The new callsigns system introduces extensive database schema additions including the CallsignModel collection and guild settings updates. Guilds will need to configure the callsigns module through the configuration command before users can request callsigns. Existing guilds will have the module disabled by default and must explicitly enable it.

### Full Changelog  

[v1.6.1...v1.7.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.6.1...v1.7.0)

---

## [Version 1.6.1](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.6.1) – August 27, 2025

### Release Notes

Minor update that fixes most recent and known bugs.

### Changed

- **Shift Quota Modal Duration Formatting:**  
  When displaying the current shift quota in the input modal, the duration string is now shortened if it exceeds 20 characters. The formatting logic replaces English time units (weeks, years, months, minutes, seconds, hours, days) with their respective abbreviations (`w`, `y`, `mo`, `min`, `s`, `h`, `d`) and removes "and" to fit the modal field. If the result is still too long, the field is left blank. This improves usability for long quotas and prevents error walls where users cannot change this setting anymore.  
  [`7ce4e66`](https://github.com/EgizianoEG/LAPD-Central-App/commit/7ce4e66f3df3e6ab925ac2e61b8f939a15f89da0)

- **Slash Command Error Handling Logic:**  
  Error logging and embed feedback during slash command execution have been restructured for clarity and reliability. Now, when an error occurs, the error ID is generated only if the error is not user-facing, and error logging is more tightly coupled to actual error display logic.  
  [`018445b`](https://github.com/EgizianoEG/LAPD-Central-App/commit/018445bc723c35615e969a65338e009e75a162eb)

- **Activity Report Spreadsheet Row Indexing:**  
  The calculation of row indices used when generating activity reports in spreadsheets has been revised. The report now always inserts records starting after the 11th row, and the ending row index is set to the greater of the previous calculation or `RowStartIndex + 1`, ensuring a minimum space for data and preventing layout errors if there are few records.  
  [`a616cf2`](https://github.com/EgizianoEG/LAPD-Central-App/commit/a616cf23d50559e7cae2387394728b9502ef1cee)

### Full Changelog  

[v1.6.0...v1.6.1](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.6.0...v1.6.1)

---

## [Version 1.6.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.6.0) – August 22, 2025

### Release Notes

Major update with expanded report fields, improved reliability in role/incident handling, and enhanced logging precision for audit and moderation.

### Added

- **Expanded Arrest Report Fields:**  
  Arrest reports now include optional fields for arrest location, division/detail, and evidence, supporting richer data collection. Schema, modal dialogs, and report embeds updated; tests revised for new inputs.  
  [1d14c89](https://github.com/EgizianoEG/LAPD-Central-App/commit/1d14c89ac44cda01ffdedeb8a7427043e547136a)

- **Nonce Field for Message Deduplication:**  
  Logging of incident, arrest, and citation reports now uses a database record ID as a message nonce to prevent duplicate log messages, improving audit integrity and tracking.  
  [5cd4541](https://github.com/EgizianoEG/LAPD-Central-App/commit/5cd45412e792d7040705c9df6e7f31508b3f0e3c)

### Changed

- **Incident Report Handling and Validation:**  
  Incident report lookup now supports ObjectId and number-based queries with timestamp validation, improving reliability for updates and embeds. Thread management logic enhanced for closed/cold status and permissions, with detailed error logging. Automatic reporter addition for new threads increases communication transparency.  
  [166cfb2](https://github.com/EgizianoEG/LAPD-Central-App/commit/166cfb2a5e4da803b34f8d43962babfad37e173c)

- **Role Persistence Restoration:**  
  Role persistence logic refactored to add a cooldown mechanism for reassignment, exponential backoff for manual removals, and more precise member state detection. Reduces spam, optimizes DB queries, and improves restoration reliability for both rejoin and manual role removal events.  
  [eb44388](https://github.com/EgizianoEG/LAPD-Central-App/commit/eb44388e86b25659593dba384ff1fc894a0ddcdb)

- **Arrest Report Logging:**  
  Arrest report logging now attaches the unique nonce, ensuring each report is tracked without duplicates.  
  [5cd4541](https://github.com/EgizianoEG/LAPD-Central-App/commit/5cd45412e792d7040705c9df6e7f31508b3f0e3c)

- **Citation Logging:**  
  Citation log messages now include a nonce for deduplication and precise tracking.  
  [5cd4541](https://github.com/EgizianoEG/LAPD-Central-App/commit/5cd45412e792d7040705c9df6e7f31508b3f0e3c)

### Fixed

- **Vehicle Data Consistency:**  
  The Jeep Cherokee was renamed to Cherokee for consistency in vehicle listings.  
  [490bc9c](https://github.com/EgizianoEG/LAPD-Central-App/commit/490bc9ce83de05811f292962f06a07c29c0c6836)

- **Duty Admin Role Assignment:**  
  Role assignment operations in duty admin commands now correctly use the target user ID, ensuring roles are not misassigned when managing shifts for others.  
  [6cae8d7](https://github.com/EgizianoEG/LAPD-Central-App/commit/6cae8d75d4b06ef65becd89d824748fe28150600)

- **Async Permission Checks:**  
  User permission checks now fetch guild members asynchronously if not cached, preventing silent failures in permission validation.  
  [5d16718](https://github.com/EgizianoEG/LAPD-Central-App/commit/5d16718867c2756eb4f1ffc9dc944ba3e3d1844d)

- **Input Filtering and FFI Reliability:**  
  Redactor input filtering now supports arrays, stricter types, and improved FFI memory management for Rust regex calls. Better error handling and logging prevent silent crashes during moderation rule applications. This functionality was impaired for a while...
  [259cefc](https://github.com/EgizianoEG/LAPD-Central-App/commit/259cefc802b8b73b2bd21970ac03bc996ebc7792)

- **Input Suspects/Officers/Witnesses Names w/ Whitespace:**
  Entering those in modals now allow white spaces in-between and now handled properly. Names/usernames must be separated with only commas.
  [a43f373](https://github.com/EgizianoEG/LAPD-Central-App/commit/a43f373d781ea9a713f3c98d95b16528b4b4899a)

### Refactored

- **Sanitization of Charge/Violation Inputs:**  
  Charge and violation inputs are now sanitized to ignore special characters except slashes, improving statute matching reliability and reducing user error impact.  
  [c92cb11](https://github.com/EgizianoEG/LAPD-Central-App/commit/c92cb116fe622effc69bade2c3a8db9f0404e7e1)

### Migration Notes

- Arrest report records now have new fields (location, division/detail, evidence). Existing records should be migrated or will default to empty/undefined/null.
- Guild database schema has been updated to track recent logged events; i.e., incident, arrests, and citation numbers to prevent duplication.

### Full Changelog

[v1.5.0...v1.4.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.5.0...v1.4.0)

---

## [Version 1.5.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.5.0) – August 8, 2025

### Release Notes

Significant update introducing flexible signature formats, enhanced config UI, database model changes, and several bug fixes for improved reliability.

### Added

- **Configurable Signature Formats for Duty Activities and Reports:**  
  Introduced support for multiple officer signature formats (Discord nickname, username, Roblox display/username) across all duty activity modules. New configuration options enable admins to select preferred signature display in logs and reports, with user interface updates for intuitive management. Code changes include a new enum, data structures, and robust validation. Tests added for signature formatting and config flows.  
  [0c010f0](https://github.com/EgizianoEG/LAPD-Central-App/commit/0c010f071aa0bd7447fbe7ff65384c857f7c578c), [2231c3a](https://github.com/EgizianoEG/LAPD-Central-App/commit/2231c3a100c004d80024deba0bc6fabef7abbc4a), [1d24d05](https://github.com/EgizianoEG/LAPD-Central-App/commit/1d24d05b3c07532595c379fbf4511af62d0ce6c0), [7a7aee6](https://github.com/EgizianoEG/LAPD-Central-App/commit/7a7aee69793cb10eea2dc8a815db11d91d719f7f)

- **Signature Fields in Database Models:**  
  Arrest, Citation, and Incident models now store officer signature strings with validation and constraints, supporting new signature formats in all relevant DB operations. Schema, types, and migration logic updated.  
  [64537bd](https://github.com/EgizianoEG/LAPD-Central-App/commit/64537bd12ebad0502b24d5ee3b93ed93386a1985)

- **Signature Generation in Duty Activity Commands and Reports:**  
  All report and log rendering now uses the new signature fields, ensuring consistency and supporting fallback logic. All relevant commands and handlers updated, with tests covering edge cases.  
  [229e5ae](https://github.com/EgizianoEG/LAPD-Central-App/commit/229e5ae0ac1824340cab6aadb2a4caa7e05f2b0c), [cb06003](https://github.com/EgizianoEG/LAPD-Central-App/commit/cb06003200c87e1252151558727b70a2a70ca176)

- **Alert Roles and Active Prefix Settings for LOA/RA Modules:**  
  Added configuration of alert roles to notify on new LOA/RA requests and a customizable "active" prefix for display names, with full UI and event logger integration.  
  [5de8334](https://github.com/EgizianoEG/LAPD-Central-App/commit/5de8334d0818e35743530709403d153c5d48dcf2), [4936a0d](https://github.com/EgizianoEG/LAPD-Central-App/commit/4936a0d302a3f1b07ba491a10e32af39ac98299a)

- **Expanded ERLC Vehicle Data:**  
  Added new vehicles and updated model attributes to keep in sync with recent ERLC updates.  
  [d1ef1bd](https://github.com/EgizianoEG/LAPD-Central-App/commit/d1ef1bddc4b9460272b4d2e3246156f3210ecebe)

- **Default-Composer Integration for MongoDB:**  
  Streamlined guild document defaults with the `default-composer` utility, reducing boilerplate and improving consistency.  
  [a2d5467](https://github.com/EgizianoEG/LAPD-Central-App/commit/a2d54675161c1f1589172844b217c24f88377b2d)

### Changed

- **Modularized & Paginated Config UI:**  
  The configuration command is now modularized and paginated, enabling scalable multi-module settings management and easier future expansion. Command interaction handling unified for improved maintainability.  
  [7e826ec](https://github.com/EgizianoEG/LAPD-Central-App/commit/7e826ec5061a63c3340831c90217ede2cfe54ab4)

- **Updated Report Templates for Signature Display:**  
  Citation, arrest, and incident report templates now display the officer’s signature instead of name, increasing audit clarity and flexibility.  
  [cb06003](https://github.com/EgizianoEG/LAPD-Central-App/commit/cb06003200c87e1252151558727b70a2a70ca176)

- **Roblox Authentication Logic:**  
  Roblox account linking is now conditionally required based on signature format, reducing unnecessary prompts and aligning with user intent.  
  [7a7aee6](https://github.com/EgizianoEG/LAPD-Central-App/commit/7a7aee69793cb10eea2dc8a815db11d91d719f7f)

- **Updated Human-Readable Error Messages:**  
  Several error messages were rephrased for clarity and user-friendliness.  
  [a379219](https://github.com/EgizianoEG/LAPD-Central-App/commit/a3792191f90d129e4613b8cac64278dcc331632e)

- **Dependency Upgrades:**  
  Upgraded core, testing, and utility dependencies (discord.js, mongoose, jest, typescript, remeda, and more) for improved performance, security, and compatibility.  
  [0575fc3](https://github.com/EgizianoEG/LAPD-Central-App/commit/0575fc3ebeb25d55f4476c8511750430489ad588), [b3cd277](https://github.com/EgizianoEG/LAPD-Central-App/commit/b3cd277bd275a00b7216dfad855ede09bdf9d24f), [72b17f9](https://github.com/EgizianoEG/LAPD-Central-App/commit/72b17f928e4591a1d4b3e892215e4db87fd6c2b2), [915efc5](https://github.com/EgizianoEG/LAPD-Central-App/commit/915efc5b849235272bd71ed2e0e9593aaab7999b)

- **Refined Module State Management in Config:**  
  Improved detection of unsaved changes and more accurate modification tracking in module state.  
  [f98f203](https://github.com/EgizianoEG/LAPD-Central-App/commit/f98f203abcb5620307897d966f674e32697358a3)

- **Duty Activities Config Improvements:**  
  Signature format options added, validation improved, and feedback for unchanged saves clarified.  
  [8cfa346](https://github.com/EgizianoEG/LAPD-Central-App/commit/8cfa346956cef3434caf86ae675b2e5f8639259d)

### Fixed

- **CreateShiftReport Null Sheet Id Handling:**  
  Fixed a bug where null sheet IDs could cause errors during shift report creation, improving reliability for shift logging.  
  [f022e2d](https://github.com/EgizianoEG/LAPD-Central-App/commit/f022e2dc4dfdbd2d982e2f936ba25279c9fc71f3)

- **Arrest Reports Minor Fixes:**  
  Addressed minor bugs affecting arrest report generation and embed consistency.  
  [82de5c8](https://github.com/EgizianoEG/LAPD-Central-App/commit/82de5c87780f5b9e7cc81a4321037bc6b50056fd)

- **Module Modification State Accuracy in Config:**  
  Fixed inaccurate detection of unsaved module state in settings UI, ensuring correct prompts for unsaved changes.  
  [f98f203](https://github.com/EgizianoEG/LAPD-Central-App/commit/f98f203abcb5620307897d966f674e32697358a3)

- **FormatUsername Test Expectation:**  
  Updated tests to reflect correct lowercase output for invalid usernames, ensuring test suite reliability.  
  [cae28cc](https://github.com/EgizianoEG/LAPD-Central-App/commit/cae28cc7bfc24b844260512ff3842d3b04c0e92f)

- **Guild/Channel Fetching in GuildMessages:**  
  Fixed async thread/channel fetching to better handle uncached states, reducing error rates.  
  [2b5ec2b](https://github.com/EgizianoEG/LAPD-Central-App/commit/2b5ec2bfb9e45587079dd54e1023d83e67fa6935)

- **Linting Errors:**  
  Corrected code style and linting issues to pass updated linter and CI checks.  
  [4c6eb78](https://github.com/EgizianoEG/LAPD-Central-App/commit/4c6eb78d7cfa5d341d1de25d91abb816d95aabaf)

### Refactored

- **Signature Format Enum and Bit Field Logic:**  
  Renamed `DASignatureFormat` to `DASignatureFormats` and corrected bit field operations for clarity, maintainability, and bug prevention.  
  [6875f52](https://github.com/EgizianoEG/LAPD-Central-App/commit/6875f521f9abd5ca64ea582df7bbbdb962e09dc9)

- **Config UI and Button Placement:**  
  Refactored default server quota set button position for better user experience, and cleaned up related formatting in config code.  
  [b298409](https://github.com/EgizianoEG/LAPD-Central-App/commit/b298409b9ed64c400640faaf57cf2ec78d0c347b)

- **UpdateIncidentReport Uses Remeda:**  
  Replaced lodash with remeda utilities for deep equality checks to reduce bundle size and improve performance.  
  [7245010](https://github.com/EgizianoEG/LAPD-Central-App/commit/7245010580ee96f87bf4e6e32194afcc242057d6)

- **Converters Cleanup:**  
  Removed unnecessary clarifications in converter logic for code clarity.  
  [c168f14](https://github.com/EgizianoEG/LAPD-Central-App/commit/c168f140e804c1b3000ca4416e4bd3a60f3751a3)

### Removed

- **Lodash Dependency:**  
  Fully removed lodash and @types/lodash in favor of remeda, simplifying the codebase and reducing dependency footprint.  
  [915efc5](https://github.com/EgizianoEG/LAPD-Central-App/commit/915efc5b849235272bd71ed2e0e9593aaab7999b)

- **Redundant Officer Name Fetching:**  
  Removed unnecessary officer name resolution in arrest reports, relying on new signature logic.  
  [cb06003](https://github.com/EgizianoEG/LAPD-Central-App/commit/cb06003200c87e1252151558727b70a2a70ca176)

### Tests/QA Notes

- Test suites were updated and extended to cover new signature formats, config UI behaviors, and migration logic. Tests for FormatUsername and other utilities were revised for new logic and output.

### Full Changelog  

[v1.4.0...v1.3.2](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.4.0...v1.3.2)

---

## [Version 1.4.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.4.0) – July 21, 2025

### Added

- **Duty Management:** Switched to using Components V2 for the slash command prompt and its button interactions, enhancing the user interface and interactivity. ([16ebd091](https://github.com/EgizianoEG/LAPD-Central-App/commit/16ebd091de553ccf7597e3120d9618bfc62be814))
- **BaseExtraContainer:** Added optional separator configuration for titles, improving flexibility in component presentation. ([1d3486ba](https://github.com/EgizianoEG/LAPD-Central-App/commit/1d3486baca5277c63e75cf14b7698fce07cdb32e))

### Refactored

- **CreateActiveShiftEmbed:** Removed unnecessary Timestamp parameter and updated related function calls, relying on command execution timestamp for accuracy. ([3fb466b0](https://github.com/EgizianoEG/LAPD-Central-App/commit/3fb466b064a299177bdb6066e5eff602bcd7aa32))
- **Error Handling:** Enhanced error message for nonexistent Roblox usernames and added a timeout to user ID lookup. ([60297270](https://github.com/EgizianoEG/LAPD-Central-App/commit/602972703bbc9d94c0f853bf1765707e6e3f051e))

### Fixed

- **Shift Management:** Checked for prompt Components V2 usage in shift action handling to ensure proper operation. ([4ad20584](https://github.com/EgizianoEG/LAPD-Central-App/commit/4ad205842f8da4900a8f14e4bee389da06cc6cec))
- **BaseExtraContainer:** Updated separator handling in the title method, improved usage of IDs, and updated component tests related to IDs. ([127ceb68](https://github.com/EgizianoEG/LAPD-Central-App/commit/127ceb681612d8f9d47d076601b04e4f207350b8))
- **Logging:** Improved handling of non-existent logging channels and updated the database accordingly. ([c4996285](https://github.com/EgizianoEG/LAPD-Central-App/commit/c49962850f6352adf180d623f9ef249a3a069ad5))
- **Sweepers:** Updated message filter logic to better handle edge cases. ([02b18c51](https://github.com/EgizianoEG/LAPD-Central-App/commit/02b18c51bb51def863edd6b78fb8678d06381d8c))
- **Formatting:** Fixed a Prettier formatting error. ([16c8e8dd](https://github.com/EgizianoEG/LAPD-Central-App/commit/16c8e8dda265acd0bfd400d4ca130255b43a34b1))
- **Incident Number Validation:** Revised MDT command incident number validation and error handling. ([54d8d5f7](https://github.com/EgizianoEG/LAPD-Central-App/commit/54d8d5f7179e0838154615eb08cefa804a714c42))
- **GetIncidentRecord:** Improved incident ID validation logic. ([5a9e1192](https://github.com/EgizianoEG/LAPD-Central-App/commit/5a9e1192d9d18d8d01044eb64e63b8badb7999c4))
- **Log Arrest:** Fixed primary officer fallback select not functioning. ([e6836490](https://github.com/EgizianoEG/LAPD-Central-App/commit/e6836490804a63b21458fb4f2c564947b57dca00))

### Other

- Updated package.json description. ([0f09ad7b](https://github.com/EgizianoEG/LAPD-Central-App/commit/0f09ad7b72c86e78e05ef5e69d4c633df1d2226a))
- Bumped version to 1.4.0 and revised vulnerabilities. ([7e67f064](https://github.com/EgizianoEG/LAPD-Central-App/commit/7e67f06469b6a936edaf115c29e128281f9584b8))

### Full Changelog

[v1.3.2...v1.4.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.3.2...v1.4.0)

---

## [Version 1.3.2](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.3.2) – July 6, 2025

- Warns about Manage Server permission for fetching/retrieving/enforcing automoderation rules and handles permission errors.
- Minor enhancements and text reformatting for arrest charges text

[v1.3.1...v1.3.2](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.3.1...v1.3.2)

---

## [Version 1.3.1](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.3.1) – June 27, 2025

- Fixes issue template typo and permissions record.
- Revise fallback and error handling for activity report generation.
- Make usage of the additional field, average time, in activity report statistics.

[v1.3.0...v1.3.1](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.3.0...v1.3.1)

---

## [Version 1.3.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.3.0) – June 22, 2025

### What's Changed

* feat: role persistence slash commands; more advanced than alternatives with multiple role allowance, reason, and expiry by @EgizianoEG in <https://github.com/EgizianoEG/LAPD-Central-App/pull/74>

[v1.2.0...v1.3.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.2.0...v1.3.0)

---

## [Version 1.2.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.2.0) – June 6, 2025

### What's Changed

* chore(deps): bump googleapis from 148.0.0 to 149.0.0 by @dependabot in <https://github.com/EgizianoEG/LAPD-Central-App/pull/71>
* chore(deps): bump node-cron from 3.0.3 to 4.0.7 by @dependabot in <https://github.com/EgizianoEG/LAPD-Central-App/pull/70>
* refactor: utilities, typings, and data structure for better organization by @EgizianoEG in <https://github.com/EgizianoEG/LAPD-Central-App/pull/72>

[v1.1.0...v1.2.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.1.0...v1.2.0)

---

## [Version 1.1.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.1.0) – May 28, 2025

Introduces bug fixes and consistent styling for `duty admin` and `member-roles` commands.

[v1.0.0...v1.1.0](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.0.0...v1.1.0)

---

## [Version 1.0.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.0.0) – May 26, 2025

### First Release of LAPD Central

Stable features and functionality (hopefully).

[v1.0.0](https://github.com/EgizianoEG/LAPD-Central-App/commits/v1.0.0)

---

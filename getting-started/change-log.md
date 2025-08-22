---
description: >-
  Track LAPD Central's evolution with detailed release notes, feature additions,
  and bug fixes. Each version includes commit links for full transparency.
icon: newspaper
---

# Change Log

## Version 1.6  — August 23, 2025

See on [GitHub](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.6.0).

## Version 1.5  — August 9, 2025

See on [GitHub](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.5.0).

## Version 1.4  — July 21, 2025

See on [GitHub](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.4.0).

## [Version 1.3](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.3.0) — June 2&#x32;**, 2025**

### **Enhancements**

* **Full Date Range Filtering for Shift Reports and Officer Activity:**\
  Commands like `/activity officer` and `/activity report` now support both `since` and `to` (until) parameters, allowing you to view activity and generate reports for any custom date range, not just "since" a single point. Autocompletion is provided for common ranges like "today", "yesterday", "30 days ago", etc., for both fields.
* **Role Persistence System:**\
  A new `/role-persist` command lets management persist specific member roles so they are automatically restored if a user rejoins the server. Roles can have an optional expiry and are protected against risky (admin-level) roles. Includes add, remove, and list subcommands, and a scheduled job for auto-removal of expired records.
* **Live MongoDB Change Streams & Performance Caching:**\
  Major refactor for live cache of Discord guild and shift data, using MongoDB change streams and new in-memory cache collections for performance.
* **Shift Reports and Activity Data Sorting:**\
  Shift activity and report exports are now sorted by total shift time, then by role hierarchy, then alphabetically, making it easier to review top performers and accurately track quotas.
* **Improved Error Handling & Validation:**\
  Date and duration fields now enforce non-negative values and stricter validity checks, with clearer error messages for role persistence, duration, and date range issues.
* **Cleaner Autocompletion, Faster Lookups:**\
  Autocomplete for shift types, saved/persisted roles, booking/citation/incident numbers now uses a new caching backend for faster, more accurate suggestions.
* **Improved Logging and Debugging:**\
  Application and database logging is now color-coded and more detailed in the console.
* **Dependency Updates:**
  * `discord.js` updated to v14.20.0
  * `noblox.js`, `undici`, `@discordjs/rest/ws`

### **Fixes**

* **Negative/Invalid Duration Handling:**\
  All duration fields (shifts, LOA/RA requests, etc.) now properly reject negative values and invalid input, preventing issues with accidental copy-pastes or typos.
* **Role Mention/Autocomplete and Member Role Save:**\
  Bugfixes for role mention, member role backup/restore, and autocomplete now handle missing, deleted, or renamed roles more gracefully.
* **Cleaner Button/Component State Management:**\
  Improved interaction component state (disabling, updating, error fallback) in paginated lists, management prompts, and UAN/LOA/RA approval workflows.



Overall, this release adds a powerful new role persistence system, expands activity reporting options, improves performance and reliability, and addresses long-standing issues with data consistency, command validation, and member management.

[**Full diff: v1.2.0...v1.3.0**](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.2.0...v1.3.0)

***

## [Version 1.2](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.2.0) <sub>—  June 6</sub><sub>**, 2025**</sub>

### Enhancements

* **Shift Leaderboard Filtering by Time:**\
  The Duty Leaderboard command now allows filtering results to show shift data since a specific date or timeframe, using natural language (e.g., "7 days ago"). This makes it much easier to view recent activity and trends without external calculations. Predefined time expressions like "yesterday", "7 days ago", "30 days ago" were also added as autocomplete suggestions for the leaderboard since parameter\
  ([`cbc8be1`](https://github.com/EgizianoEG/LAPD-Central-App/commit/cbc8be1ae170abbf72d6aca96e3ee5e9398259ad), [`92c6432`](https://github.com/EgizianoEG/LAPD-Central-App/commit/92c64322d19a90ec57be33157cd8534d189de9f7))
* **Enhanced Leaderboard Statistics Display:**\
  Added total duration display and improved footer information for duty leaderboards, providing better insight into overall team activity and performance metrics.\
  ([`df9d9db`](https://github.com/EgizianoEG/LAPD-Central-App/commit/df9d9dbc2b5c865f7c621babcf0141eca0f4b3ad))
* **Arrest Log Data Consistency & New Command Option:**\
  New slash command option `primary-officer`. Arrest model and its helper functions were updated for more granular officer tracking (distinguishing between arresting and reporting officers), and the arrest report embed now clearly displays who submitted and who performed the arrest. This eliminates ambiguity during report review.\
  ([`543d296`](https://github.com/EgizianoEG/LAPD-Central-App/commit/543d29672a1e19075fb2db5942741d90ad821d4d))
* **More Responsive and Accurate Data Caching:**\
  Adjusted caching strategies (e.g., for auto-moderation rules) and improved the efficiency of some queries, which speeds up the bot's responses and reduces database/API load. Increased cache TTL for autocompletion systems.\
  ([`7778a6f`](https://github.com/EgizianoEG/LAPD-Central-App/commit/7778a6f54167b1d241466446b29e1ac104776f2e))
* **Improved README and Documentation:**\
  The README style changed from HTML tags to pure markdown and was expanded to include project motivation, prerequisites, configuration, and clearer install steps, making onboarding and contributions easier for new users and clarifying the app's mission.\
  ([`5169073`](https://github.com/EgizianoEG/LAPD-Central-App/commit/5169073bd176e29a9443452565fd51698a77e2aa))
* **Updated Dependencies and Runtime Requirements:**\
  Bumped Node.js requirement to v24.1.0+ and several key libraries to latest versions for improved security and compatibility, including new support for Fuse.js fuzzy search and updated Google APIs.\
  ([`184d079`](https://github.com/EgizianoEG/LAPD-Central-App/commit/184d07959e948e348ec19a38f9d0fa3a47d26ad6))

### Fixes

* **Activity Report Default Shift Type Handling:**\
  Fixed an issue where activity reports would fail when "default" shift type was specified, now properly handles default shift type with appropriate access roles.\
  ([`76c17e6`](https://github.com/EgizianoEG/LAPD-Central-App/commit/76c17e68bfcd676c46c41f40cdece15c3fd79b0a))
* **Test Suite Improvements:**\
  Fixed test mocking issues and included proper import handling for the Discord app, ensuring more reliable test execution.\
  ([`02c7c20`](https://github.com/EgizianoEG/LAPD-Central-App/commit/02c7c20ac556b02c1dad871c320e8e8e8029ad63))

### Refactoring

* **Google Sheets Configuration Update:**\
  Updated default ActivityReportTempSpreadsheetID in configuration files to point to the new template, ensuring proper functionality of activity report generation.\
  ([`7196975`](https://github.com/EgizianoEG/LAPD-Central-App/commit/719697507a8bf19d0ff678ca762650296e6f9cda))
* **Large-Scale Reorganization:**\
  All utility functions were reorganized into clearer directories (`Helpers`, `Discord`, `Reports`, `External`, etc.), replacing generic `Other` folders. This makes the codebase more maintainable and easier to navigate for future development. Improved type definitions organization and resource organization.

### Other Notable Changes

* **Enhanced Vehicle Name Autocompletion:**\
  Vehicle autocomplete now uses fuzzy searching (Fuse.js) along with the existing matching method for more accurate and user-friendly suggestions, especially with partial or misspelled names.
* **Leave of Absence & Reduced Activity Command Logic:**\
  The logic for requesting leaves and reduced activity was rewritten to avoid conflicts—users are now prevented from submitting overlapping requests (such as requesting an RA while there is an active or pending one, or an active or pending LOA), with specific, actionable error messages.
* **Incident Attachment Deduplication:**\
  When multiple image attachments are submitted to an incident, duplicates are now filtered out, preventing clutter and redundancy in reports.
* **New Vehicle Added:**\
  The "Corvette X08" (duplicate for "Corbeta 1M Edition" in-game) was added to the ERLC vehicle data.

[**Full diff: v1.1.0...v1.2.0**](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.1.0...v1.2.0)

***

## [Version 1.1](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.1.0) —  **May 28, 2025**

### Enhancements

* **User Presence Checks Added:**\
  Many admin and moderation commands now verify if a user is currently a member of the Discord server before allowing certain actions (like shift/leave creation or notice approval).\
  &#xNAN;_&#x57;hy:_ Prevents errors and confusion by ensuring actions can only be taken on active members and with their consent.
* **Improved Feedback Containers:**\
  Migrated from using standard embed components (e.g., `SuccessEmbed`, `InfoEmbed`) to specialized containers like `SuccessContainer`, `InfoContainer`, and `ErrorContainer` for user feedback.
* **Consistent Role Backup and Restore UI:**\
  The role backup and restore flows (all commands) now use enhanced containers and no more embeds, display role lists as clickable mentions, and include backup reasons in the descriptions.

### Notable Fixes

* **Button Interaction Consistency:**\
  Updated panel button handling to reliably extract user IDs and provide the correct context for all actions.\
  &#xNAN;_&#x57;hy:_ Fixes edge cases where button interactions could fail or target the wrong user.
* **Role Backup List Being Shown Unsorted:**\
  Sort order for listing member role backups now uses the correct field (`saved_on` instead of `saved_at`).

### Refactoring

* **Embed/Container Refactor:**\
  Many code paths now use new container classes for responses instead of direct embeds, making the feedback system more modular and maintainable.
  * E.g., replaced `SuccessEmbed`/`ErrorEmbed` with `SuccessContainer`/`ErrorContainer` in admin and utility modules.
  * Additional error and info messages in `AppMessages.ts`.
* **Utility Function Renames and Parameterization:**\
  Functions like `GetTargetMember` have been revised and renamed to `GetTargetUser` with clearer parameter types and usages.

### Additional Notes

* **Cooldown Adjustments:**\
  The duty import command cooldowns and timeframes were shortened for both user and guild scopes.

[**Full diff: v1.0.0...v1.1.0**](https://github.com/EgizianoEG/LAPD-Central-App/compare/v1.0.0...v1.1.0)

***

## [Version 1.0](https://github.com/EgizianoEG/LAPD-Central-App/releases/tag/v1.0.0)  —  **May 26, 2025**

The first official and stable version of LAPD Central Discord application.

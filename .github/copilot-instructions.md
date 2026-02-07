# Copilot Instructions for LAPD Central Discord App

## Project Overview

This is a feature-rich Discord bot built with discord.js v14 for ER:LC LAPD roleplay communities. The bot provides utility commands, management modules, and roleplay-specific features. It's a TypeScript/Node.js application that uses MongoDB for data persistence and integrates with Roblox, Google, and other external APIs.

**Repository Size:** ~360 files, 18MB
**Primary Language:** TypeScript (ES Modules)
**Runtime:** Node.js 24.1.0+, npm 11.2.0+
**Framework:** discord.js v14.25.1+
**Database:** MongoDB (Mongoose v9)
**Testing:** Jest with ts-jest
**Build Tool:** TypeScript Compiler (tsc)
**HTTP Server:** Express v5.1.0 (currently for HTTP health checks and metrics)

## Critical Setup Steps

### Initial Setup (ALWAYS Required)

1. **Copy the secrets file FIRST** - This is mandatory before any other operation:

   ```bash
   npm run cp:secrets
   ```

   This creates `Source/Config/Secrets.ts` from the example template. Without this file, TypeScript compilation and tests will fail.

2. **Install dependencies** - Use `npm ci` for clean installs:
   ```bash
   npm ci
   ```

### Build Process

**Standard build command:**

```bash
npm run build
```

This runs: `tsc` → `cp:sf-to-b` (resource copy)

**Time:** ~5-20 seconds
**Output:** `Build/` directory with compiled JavaScript

The build process:

1. Compiles TypeScript to JavaScript in `Build/` directory using the TypeScript compiler
2. Copies resource files (Imgs, Fonts, HTML, Libs) from `Source/Resources/` to `Build/Resources/`

**Note:** Path aliases (`#Source/*`, `#Utilities/*`, etc.) are resolved at runtime by Node.js using the `imports` field in [`package.json`](../package.json), not during the build process.

**Clean build:**

```bash
npm run clean-build
```

Removes the `Build/` directory before rebuilding.

### Linting

**Run all linters:**

```bash
npm run lint
```

This executes three checks sequentially:

1. `tsc --noEmit` - TypeScript type checking
2. `eslint "Source/**/*.{js,ts}"` - ESLint linting
3. `prettier -c --end-of-line auto "Source/**/*.{js,ts,json}"` - Prettier formatting check

**Time:** ~60-120 seconds

**Known linting issues in the codebase:**

- Some files have cognitive complexity warnings and regex complexity warnings (expected, not many, still not blocking)

### Testing

**Run all tests:**

```bash
npm test
```

Or use the GitHub workflow command:

```bash
npm test -- --testPathIgnorePatterns=Secrets.*.ts
```

**Time:** ~50-120 seconds

**Test-specific commands:**

```bash
npm run test:utils        # Run utility tests
npm run test:other        # Run other tests
npm run test:coverage     # Run with coverage report
```

### Running the Application

**Development (TypeScript with tsx):**

```bash
npm start
# or as an alias
npm run start:ts
```

**Development with watch mode:**

```bash
npm run watch
```

**Production (compiled JavaScript):**

```bash
npm run start:js
```

**Production with PM2:**

```bash
npm run start:prod
```

## Project Structure

### Root Directory Files

```
.editorconfig             # Editor formatting rules (2 spaces, CRLF line endings)
.prettierrc.json          # Prettier config (tabWidth: 2, endOfLine: crlf)
eslint.config.mjs         # ESLint flat config (TypeScript + stylistic rules)
tsconfig.json             # TypeScript compiler config with path aliases
jest.config.ts            # Jest testing configuration
babel.config.js           # Babel presets for Jest
package.json              # Dependencies and scripts
Procfile                  # Heroku deployment config
pm2.ecosystem.config.example.cjs  # PM2 process manager example
```

### Source Directory Structure (`Source/`)

```
Source/
├── Main.ts                   # Application entry point, Discord client initialization, and Express server
├── Commands/                 # Discord command implementations (~73 files)
│   ├── CtxMenu/              # Context menu commands
│   ├── Development/          # Developer/admin commands
│   ├── Informative/          # Info/help and other related commands
│   ├── Miscellaneous/        # General commands, categorized as modules when possible
│   └── Utility/              # Utility commands (largest category in LOC)
├── Config/                   # Configuration files
│   ├── Secrets.example.ts    # Template for credentials (COPY THIS FIRST)
│   ├── Secrets.ts            # Actual credentials (required, gitignored, created by cp:secrets)
│   ├── Constants.ts          # Application common and shared constants
│   └── Shared.ts             # Shared configuration
├── Events/                   # Discord.js event handlers (~18 files)
│   ├── ClientReady/
│   ├── GuildCreate/
│   ├── InteractionCreate/    # Command/button/modal handling
│   └── [other event dirs]/
├── Handlers/                 # Core handlers (~9 files)
│   ├── ExpressServer.ts      # HTTP server for health checks and metrics
│   └── [Other handlers]
├── Jobs/                     # Scheduled/background jobs with node-cron
├── Models/                   # Database model definitions (~16 files)
│   ├── Functions/            # Model and Schema specific helper functions
│   └── Schemas/              # Mongoose schemas
├── Resources/                # Static resources (~59 files)
│   ├── AppEmojis/            # Emoji definitions; custom emoji image files used by the app
│   ├── ERLC-Data/            # ER:LC game-related data
│   ├── Fonts/                # Font files (copied to Build/)
│   ├── HTML/                 # HTML templates (copied to Build/)
│   ├── Imgs/                 # Images (copied to Build/)
│   ├── Libs/                 # Library files, binary (copied to Build/)
│   └── RegularExpressions.ts # Regex patterns (May have complexity issues, expected)
├── Typings/                  # TypeScript type definitions
│   ├── Core/                 # Core type definitions
│   ├── External/             # External library types
│   └── Utilities/            # Utility type definitions
└── Utilities/                # Helper utilities (104 files, largest section)
    ├── Autocompletion/       # Command options autocomplete handlers
    ├── Classes/              # Utility classes (e.g., AppLogger, Event Loggers)
    ├── Database/             # Database utilities
    ├── Discord/              # Discord-specific helpers
    ├── External/             # External API integrations
    ├── Helpers/              # General helper functions (including MetricsCollector)
    ├── ImageRendering/       # Image generation utilities with @napi-rs/canvas
    ├── Reports/              # Report generation
    ├── Roblox/               # Roblox API integration
    └── Strings/              # String manipulation utilities
```

### Test Directory (`Tests/`)

```
Tests/
├── tsconfig.json             # Test-specific TypeScript config
├── Components/               # Component tests
├── Utils/                    # Utility function tests
└── Other/                    # Other tests
```

### Path Aliases (Available throughout the codebase)

As mapped in `tsconfig.json` and `package.json`:

```typescript
#Source/*     -> ./Source/* (dev) / ./Build/* (prod)
#Cmds/*       -> ./Source/Commands/* (dev) / ./Build/Commands/* (prod)
#Config/*     -> ./Source/Config/* (dev) / ./Build/Config/* (prod)
#Models/*     -> ./Source/Models/* (dev) / ./Build/Models/* (prod)
#Typings/*    -> ./Source/Typings/* (dev) / ./Build/Typings/* (prod)
#Resources/*  -> ./Source/Resources/* (dev) / ./Build/Resources/* (prod)
#Utilities/*  -> ./Source/Utilities/* (dev) / ./Build/Utilities/* (prod)
#Handlers/*   -> ./Source/Handlers/* (dev) / ./Build/Handlers/* (prod)
#DiscordApp   -> ./Source/Main.ts (dev) / ./Build/Main.js (prod)
```

These path aliases are resolved at runtime using Node.js's package imports feature defined in [`package.json`](../package.json). The TypeScript compiler uses these aliases for type checking based on `tsconfig.json` paths.

## HTTP Server & Health Checks

The application includes an Express server configured in [`Source/Handlers/ExpressServer.ts`](../Source/Handlers/ExpressServer.ts) that provides:

### Available Endpoints

- `GET /` - Root endpoint
- `GET /health` - Overall health status (Discord + Database)
- `GET /metrics` - Detailed metrics (client uptime, latency, OS metrics)
- `GET /health/discord` - Discord API connectivity check
- `GET /health/database` - MongoDB connectivity check
- `GET /favicon.ico` - Favicon

**Default Port:** 10000 (configurable via `PORT` environment variable)

**Rate Limiting:** 60 requests per minute per IP

**Health Check Response Format:**

```json
{
  "status": "healthy" | "unhealthy",
  "timestamp": "ISO 8601 timestamp",
  "client": { ... },
  "database": { ... },
  "system": { ... }
}
```

## GitHub Workflows & CI/CD

### Main Workflows

1. **[`.github/workflows/RunTests.yml`](../.github/workflows/RunTests.yml)** - Tests & Linting
   - **Triggers:** Pushes and PRs to `main` branch
   - **Matrix:** ubuntu-latest, windows-latest
   - **Steps:** Checkout → Setup Node 24 → Copy secrets → Install deps → Lint → Test

2. **[`.github/workflows/AzureDeploy.yml`](../.github/workflows/AzureDeploy.yml)** - Azure Deployment
   - **Trigger:** Manual workflow dispatch
   - **Steps:** Package → Upload artifact → Deploy to Azure Web App

3. **Additional Workflows:** Render.com deploy, DigitalOcean deploy, Auto-labeler, etc.

**Workflow steps (RunTests.yml):**

1. Checkout repository
2. Setup Node.js v24.x
3. **Run `npm run cp:secrets`** (generates a dummy secrets file using environment variables and fallback placeholder values)
4. Run `npm ci` (clean install)
5. Run `npm run lint` (TypeScript check, ESLint, Prettier)
6. Run `npm test -- --testPathIgnorePatterns=Secrets.*.ts` (excludes secrets test)

## Code Style & Conventions

### Naming Conventions

- **Pascal case** for functions, arguments, constants, and variables (with some exceptions)
- Exceptions to Pascal case:
  - When following external library conventions (e.g., discord.js uses camelCase) extending their classes/interfaces or overriding methods
  - Object properties that are naturally snake_case like JSON responses from APIs and database fields
- Specific patterns:
  - Common acronyms such as URL, API, and HTTP should remain uppercase in identifiers, except for "ID", which should be written as "Id" in code and as "ID" in user-facing text (e.g., UserId, ApiResponse).
- Use clear, descriptive, and well-documented names.
- Use existing patterns when adding new code

### Formatting

- **Indentation:** 2 spaces (not tabs)
- **Line endings:** CRLF (Windows style)
- **Line width:** 100 characters max
- **Quotes:** Double quotes for strings
- **Semicolons:** Required (enforced by ESLint & auto-fixed by Prettier)
- Other formatting rules are enforced by Prettier as per [`.prettierrc.json`](../.prettierrc.json) and [`eslint.config.mjs`](../eslint.config.mjs)

### ESLint Rules (from eslint.config.mjs)

- Files to lint: `Source/**/*` only (Tests, Build, node_modules excluded)
- Cognitive complexity limit: 50
- Regex complexity threshold: 30
- Warnings on TODO comments
- Capitalized comments required

### Git Ignored Patterns (from .gitignore)

- `Secrets.[jt]s`, `Secrets.json` (credentials)
- `node_modules/**/*`
- `Build/**/*`, `Dist/**/*`, `Coverage/**/*`
- `*.log`, `logs/`
- `*.env` files
- PM2 config files (except those suffixed with `.example.cjs`)

### Command File Structure

All command files follow a consistent ordering and sectioning pattern:

1. **Imports and Dependencies** - All required imports (discord.js, utilities, models, etc.)
2. **Constants and Type Definitions** - File-level constants, enums, and type definitions
3. **Helper Functions** - Private helper functions used by the command (if any)
4. **Handling Functions and Command Callback** - The main command callback and major interaction handlers
5. **Command Structure Definition** - The command data builder (SlashCommandBuilder, etc.)
6. **Export** - Single `export default` statement at the end

**Section Separators:**
Each section is separated by comment blocks:

```typescript
// ---------------------------------------------------------------------------------------
// Section Name:
// -------------
```

**Example structure:**

```typescript
// Imports
import { SlashCommandBuilder } from "discord.js";
import SomeUtility from "#Utilities/SomeUtility.js";

// ---------------------------------------------------------------------------------------
// Constants:
// ----------
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------------------
// Helper Functions:
// -----------------
function HelperFunction() {
  // ...
}

// ---------------------------------------------------------------------------------------
// Command Handling:
// -----------------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  // ...
}

// ---------------------------------------------------------------------------------------
// Command Structure:
// ------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandBuilder().setName("example").setDescription("Example command."),
};

// ---------------------------------------------------------------------------------------
export default CommandObject;
```

### Command Organization Hierarchy

The codebase organizes commands into three levels:

1. **Main Commands** - Standalone commands with no subcommands
   - Located directly in their category folder
   - Example: [`Source/Commands/Informative/Help.ts`](Source/Commands/Informative/Help.ts)
   - Usage: `/help`

2. **Commands with Subcommands** - Commands that have subcommands but no groups
   - Main command handler: `Main.ts` in the command's folder
   - Subcommands: `Subcmds/` directory containing individual subcommand files
   - Example structure:
     ```
     Commands/Informative/Activity/
     ├── Main.ts           # Main command orchestrator
     └── Subcmds/
         ├── Officer.ts    # /activity officer
         └── Report.ts     # /activity report
     ```
   - Usage: `/activity officer`, `/activity report`

3. **Commands with Subcommand Groups** - Commands that have grouped subcommands
   - Main command handler: `Main.ts` in the command's folder
   - Subcommand group: Separate folder with its own `Main.ts`
   - Group's subcommands: `Subcmds/` within the group folder
   - Example structure:
     ```
     Commands/Miscellaneous/Duty/
     ├── Main.ts                    # Main command orchestrator
     ├── Subcmds/
     │   ├── Manage.ts              # /duty manage
     │   └── Active.ts              # /duty active
     └── Duty Types/
         ├── Main.ts                # Subcommand group handler
         └── Subcmds/
             ├── Create.ts          # /duty types create
             ├── Delete.ts          # /duty types delete
             └── View.ts            # /duty types view
     ```
   - Usage: `/duty manage`, `/duty types create`

**Main Command Handler Pattern:**

The `Main.ts` file serves as the orchestrator that:

- Imports all subcommands and/or subcommand groups
- Contains the main command callback that routes to appropriate subcommand handlers
- Defines the top-level command builder
- Adds subcommands/groups to the command data

### Commit & Pull Request Conventions

**Use Conventional Commits for PR titles and Commit messages.**

- **Format:** `<type>[+<type>...](<scope>): <description>`
- **Scope:** Optional, e.g., `(rubocop)`, `(auth)`, `(shift-handler)`.
- **Description:** Short and imperative (start with lower case).

**Allowed Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semi-colons, etc (no code change)
- `refactor`: Refactoring production code
- `perf`: Performance improvements
- `test`: Adding missing tests
- `chore`: Maintenance tasks

**Examples:**

- `feat(ctx-menu): add user report context command`
- `fix(shift-model): prevent break end on null timestamp`
- `chore: update dependencies`

## Common Development Workflows

### Making Code Changes

1. Always start by running `npm run cp:secrets` if Secrets.ts doesn't exist
2. Install dependencies: `npm ci`
3. Make your changes in `Source/` directory
4. Run linting: `npm run lint` (fix any new issues you introduce)
5. Build: `npm run build` (verify TypeScript compiles)
6. Run tests: `npm test` (ensure you don't break passing tests)
7. Commit changes (exclude Build/, node_modules/, Secrets.ts)

### Adding New Commands

- Place in appropriate subdirectory under `Source/Commands/`
- Follow existing command structure patterns
- Register in the command handler if needed
- Add types to `Source/Typings/` if needed

### Modifying Database Models

- Schemas are in `Source/Models/Schemas/`
- Database and schema functions in `Source/Models/Functions/`
- Uses Mongoose v9 with TypeScript
- Update types in `Source/Typings/Utilities/Database` if needed

### Working with Resources

- Static files in `Source/Resources/`
- Remember: Imgs, Fonts, HTML, and Libs subdirectories are copied to Build/ during build
- Changes to these require a rebuild to take effect only for the compiled output; development runs read directly from `Source/Resources/`

### Adding Health Check Metrics

- Health check logic is in [`Source/Utilities/Helpers/MetricsCollector.ts`](../Source/Utilities/Helpers/MetricsCollector.ts)
- Express endpoints are in [`Source/Handlers/ExpressServer.ts`](../Source/Handlers/ExpressServer.ts)
- Metrics include: Discord API latency, MongoDB latency, OS metrics, client uptime

## Environment & Dependencies

### Required Environment Variables (from Secrets.example.ts)

- `BOT_TOKEN` - Discord bot token
- `MONGO_URI`, `MONGO_DB`, `MONGO_USERNAME`, `MONGO_USERPASS` - MongoDB credentials
- `ROBLOX_COOKIE`, `ROBLOX_CLOUD_KEY` - Roblox API
- Google API credentials - For spreadsheet generation (optional)
- Various API keys (ImgBB, OpenWeather, Bloxlink, Logtail)

All have placeholders in [`Source/Config/Secrets.example.ts`](../Source/Config/Secrets.example.ts) for development/testing.

### Key Dependencies

- **discord.js** ^14.25.1 - Discord bot framework
- **mongoose** ^9.1.5 - MongoDB ODM
- **express** ^5.1.0 - HTTP server (for health checks and metrics)
- **axios** ^1.11.0 - HTTP client
- **chalk** ^5.5.0 - Terminal colors
- **winston** ^3.18.3 - Logging
- **@napi-rs/canvas** ^0.1.76 - Image manipulation & generation
- **noblox.js** ^7.3.1 - Roblox API client

### Development Dependencies

- **typescript** ^5.8.3
- **tsx** ^4.20.3 - TypeScript executor
- **ts-jest** ^29.4.4 - Jest TypeScript support
- **eslint** ^9.32.0 + TypeScript plugins
- **prettier** ^3.6.2

## Important Notes & Gotchas

1. If nonexistent, **ALWAYS run `npm run cp:secrets` first** - This is the single most important step. Without it, nothing works.

2. **Path aliases are runtime-resolved** - The path aliases (e.g., `#Source/*`, `#Utilities/*`) are resolved at runtime by Node.js using the `imports` field in [`package.json`](../package.json). TypeScript uses `tsconfig.json` paths for type checking during development.

3. **Resource files must be copied** - If you modify files in `Source/Resources/{Imgs,Fonts,HTML,Libs}`, you must rebuild to see changes in the Build/ directory.

4. **CRLF line endings** - This project uses Windows-style (CRLF) line endings. Configure your editor accordingly or use the [`.editorconfig`](../.editorconfig) file.

5. **Pascal case convention** - Unlike typical JavaScript/TypeScript projects that use camelCase, this project uses PascalCase for most identifiers. Follow existing patterns in the file you're editing.

6. **Global type definitions** - There are global type definitions in `Source/Typings/`, for example, `DiscordClient` is a custom extended client type and `SlashCommandInteraction` is a custom interaction type. Both are used widely across the codebase and are generic.

7. **Express server runs on app start** - The Express server is automatically started when the Discord client initializes. Default port is 10000 unless `PORT` environment variable is set.

## Quick Reference Commands

```bash
# Setup
npm run cp:secrets              # FIRST: Create secrets file
npm ci                          # Install dependencies (clean)

# Development
npm start                       # Run with tsx (TypeScript)
npm run watch                   # Run with watch mode
npm run start:js                # Run compiled JavaScript
npm run start:prod              # Run with PM2

# Building
npm run build                   # Standard build
npm run clean-build             # Clean + build

# Quality Checks
npm run lint                    # Run all linters (tsc + eslint + prettier)
npm test                        # Run all tests
npm run test:utils              # Run utility tests only
npm run test:coverage           # Run with coverage report

# CI Simulation (what GitHub Actions runs)
npm run cp:secrets && npm ci && npm run lint && npm test -- --testPathIgnorePatterns=Secrets.*.ts
```

## Deployment Options

The project supports multiple deployment platforms:

1. **Azure Web App** - Via [`.github/workflows/AzureDeploy.yml`](../.github/workflows/AzureDeploy.yml)
   - Manual workflow dispatch
   - Uses publish profile secret
   - Automatic build on Azure
   - Suggestions:
     - SCM_DO_BUILD_DURING_DEPLOYMENT: `true`
     - PRE_BUILD_COMMAND: `rm -rf Build & npm run cp:secrets`
     - Start command: `npm run start:prod`

2. **DigitalOcean App Platform** - Via [`.github/workflows/DigitalOceanDeploy.yml`](../.github/workflows/DigitalOceanDeploy.yml)
   - Manual workflow dispatch
   - Uses DigitalOcean API token secret
   - Automatic build on DigitalOcean
   - Suggestion:
     - Build command: `npm run cp:secrets && npm run build & npm i pm2`
     - Run command: `pm2 start pm2.ecosystem.config.example.cjs --env production`

3. **Heroku** (unrecommended) - Via [`Procfile`](../Procfile)
   - Automatic `heroku-prebuild` script runs `cp:secrets`
   - Web dyno runs compiled JavaScript

4. **PM2** - Via [`pm2.ecosystem.config.example.cjs`](../pm2.ecosystem.config.example.cjs)
   - Local or VPS deployment
   - Process management and auto-restart
   - Environment-specific configurations

5. **Render.com** - Via respective workflow file

## Health Monitoring

The application provides comprehensive health monitoring:

- **Discord API Status**: WebSocket connection, ping latency
- **Database Status**: MongoDB connection, ping latency
- **System Metrics**: CPU usage, memory usage, uptime
- **Client Metrics**: Uptime, ready state, rate limit status

Access health endpoints for monitoring:

- `http://localhost:10000/health` - Overall health
- `http://localhost:10000/metrics` - Detailed metrics

## Trust These Instructions

These instructions are based on actual exploration and execution of the repository's build, test, and lint processes. All commands have been verified to work. Known issues (regex errors, test failures, linting warnings) are documented and are pre-existing in the main branch. When working on this repository, trust these instructions and only search for additional information if you encounter something not documented here or find these instructions to be incorrect or incomplete.

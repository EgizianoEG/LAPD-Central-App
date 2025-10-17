# Copilot Instructions for LAPD Central Discord App

## Project Overview

This is a feature-rich Discord bot built with discord.js v14 for ER:LC LAPD roleplay communities. The bot provides utility commands, management modules, and roleplay-specific features. It's a TypeScript/Node.js application that uses MongoDB for data persistence and integrates with Roblox, Google, and other external APIs.

**Repository Size:** ~360 files, 18MB
**Primary Language:** TypeScript (ES Modules)
**Runtime:** Node.js 24.1.0+, npm 11.2.0+
**Framework:** discord.js v14.23.2+
**Database:** MongoDB (Mongoose v8)
**Testing:** Jest with ts-jest
**Build Tool:** TypeScript Compiler (tsc) + tsconfig-replace-paths

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

This runs: `tsc` → `tsconfig-replace-paths` → `cp:sf-to-b` (resource copy)

**Time:** ~30-45 seconds
**Output:** `Build/` directory with compiled JavaScript

The build process:

1. Compiles TypeScript to JavaScript in `Build/` directory
2. Replaces path aliases (@Source, @Utilities, etc.) with relative paths (~805 paths in ~194 files)
3. Copies resource files (Imgs, Fonts, HTML, Libs) from `Source/Resources/` to `Build/Resources/`

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

**Time:** ~50-60 seconds

**Known test issues:**

- 3 test suites fail due to a regex syntax error in `Source/Resources/RegularExpressions.ts` (duplicate capture group name) only with lower node.js versions (e.g., 20.x)
- You may also see ts-jest warnings about "isolatedModules" - these are warnings, not errors

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
│   ├── Secrets.ts            # Actual credentials (gitignored, created by cp:secrets)
│   ├── Constants.ts          # Application common and shared constants
│   └── Shared.ts             # Shared configuration
├── Events/                   # Discord.js event handlers (~18 files)
│   ├── ClientReady/
│   ├── GuildCreate/
│   ├── InteractionCreate/    # Command/button/modal handling
│   └── [other event dirs]/
├── Handlers/                 # Core handlers (8 files)
│   └── [Command, Event, and other handlers]
├── Jobs/                     # Scheduled/background jobs
├── Models/                   # Database models (~17 files)
│   ├── Functions/            # Model and Schema specific helper functions
│   └── Schemas/              # Mongoose schemas
├── Resources/                # Static resources (~59 files)
│   ├── AppEmojis/            # Emoji definitions; custom emoji image files used by the app
│   ├── ERLC-Data/            # ER:LC game-related data
│   ├── Fonts/                # Font files (copied to Build/)
│   ├── HTML/                 # HTML templates (copied to Build/)
│   ├── Imgs/                 # Images (copied to Build/)
│   ├── Libs/                 # Library files (copied to Build/)
│   └── RegularExpressions.ts # Regex patterns (May have complexity issues)
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
    ├── Helpers/              # General helper functions
    ├── ImageRendering/       # Image generation utilities
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

As mapped in `tsconfig.json`:

```typescript
@Source/*     -> ./Source/*
@Cmds/*       -> ./Source/Commands/*
@Config/*     -> ./Source/Config/*
@Models/*     -> ./Source/Models/*
@Typings/*    -> ./Source/Typings/*
@Resources/*  -> ./Source/Resources/*
@Utilities/*  -> ./Source/Utilities/*
@Handlers/*   -> ./Source/Handlers/*
@DiscordApp   -> ./Source/Main.ts
```

## GitHub Workflows & CI/CD

### Main Workflow: `.github/workflows/RunTests.yml`

**Triggers:** Pushes and PRs to `main` branch that modify:

- `Source/**`
- `Tests/**`
- `package.json`, `package-lock.json`
- `tsconfig.json`, `jest.config.*`
- ESLint/Prettier config files

**Build Matrix:** ubuntu-latest, windows-latest

**Workflow steps (in order):**

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
- **Semicolons:** Required (enforced by ESLint)
- Other formatting rules are enforced by Prettier as per `.prettierrc.json` and `eslint.config.mjs`

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
- Uses Mongoose v8 with TypeScript

### Working with Resources

- Static files in `Source/Resources/`
- Remember: Imgs, Fonts, HTML, and Libs subdirectories are copied to Build/ during build
- Changes to these require a rebuild to take effect only for the compiled output; development runs read directly from `Source/Resources/`

## Environment & Dependencies

### Required Environment Variables (from Secrets.example.ts)

- `BOT_TOKEN` - Discord bot token
- `MONGO_URI`, `MONGO_DB`, `MONGO_USERNAME`, `MONGO_USERPASS` - MongoDB credentials
- `ROBLOX_COOKIE`, `ROBLOX_CLOUD_KEY` - Roblox API (optional for some features)
- Google API credentials - For spreadsheet generation (optional)
- Various API keys (ImgBB, OpenWeather, Bloxlink, Logtail)

All have defaults in Secrets.example.ts for development/testing.

### Key Dependencies

- **discord.js** ^v14.23.2 - Discord bot framework
- **mongoose** ^v8.17.0 - MongoDB ODM
- **express** ^v5.1.0 - HTTP server (currently for health checks)
- **axios** ^v1.11.0 - HTTP client
- **chalk** ^v5.5.0 - Terminal colors
- **winston** ^v3.11.0 - Logging
- **@napi-rs/canvas** ^v0.1.76 - Image manipulation & generation
- **noblox.js** ^v6.2.0 - Roblox API client

### Development Dependencies

- **typescript** v5.8.3
- **tsx** v4.20.3 - TypeScript executor
- **ts-jest** v29.4.4 - Jest TypeScript support
- **eslint** v9.32.0 + TypeScript plugins
- **prettier** v3.6.2

## Important Notes & Gotchas

1. **ALWAYS run `npm run cp:secrets` first** - This is the single most important step. Without it, nothing works.

2. **Path aliases are replaced during build** - The tsconfig-replace-paths step converts all `@Source`, `@Utilities` style imports to relative paths in the compiled output. This is why you see "Replaced 805 paths in 194 files" during builds.

3. **Resource files must be copied** - If you modify files in `Source/Resources/{Imgs,Fonts,HTML,Libs}`, you must rebuild to see changes in the Build/ directory.

4. **Node version flexibility** - Despite package.json requiring Node 24.1.0, the project builds successfully on Node 20.x and the CI uses Node 23.x. Engine warnings are expected and safe to ignore.

5. **Test failures are known** - Don't be alarmed by the 3 failing test suites. They fail in main branch too. Focus on not breaking the 2 passing test suites.

6. **CRLF line endings** - This project uses Windows-style (CRLF) line endings. Configure your editor accordingly or use the .editorconfig file.

7. **Pascal case convention** - Unlike typical JavaScript/TypeScript projects that use camelCase, this project uses PascalCase for most identifiers. Follow existing patterns in the file you're editing.

8. There are global type definitions in `Source/Typings/`, for example, `DiscordClient` is a custom extended client type and `SlashCommandInteraction` is a custom interaction type. Both are used widely across the codebase and are generic.

## Quick Reference Commands

```bash
# Setup
npm run cp:secrets              # FIRST: Create secrets file
npm ci                          # Install dependencies (clean)

# Development
npm start                       # Run with tsx (TypeScript)
npm run watch                   # Run with watch mode
npm run start:js                # Run compiled JavaScript

# Building
npm run build                   # Standard build
npm run clean-build             # Clean + build

# Quality Checks
npm run lint                    # Run all linters (tsc + eslint + prettier)
npm test                        # Run all tests
npm run test:utils              # Run utility tests only

# CI Simulation (what GitHub Actions runs)
npm run cp:secrets && npm ci && npm run lint && npm test -- --testPathIgnorePatterns=Secrets.*.ts
```

## Trust These Instructions

These instructions are based on actual exploration and execution of the repository's build, test, and lint processes. All commands have been verified to work. Known issues (regex errors, test failures, linting warnings) are documented and are pre-existing in the main branch. When working on this repository, trust these instructions and only search for additional information if you encounter something not documented here or find these instructions to be incorrect or incomplete.

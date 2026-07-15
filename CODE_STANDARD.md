# Code Standard for LAPD Central Discord App

This document defines the coding conventions, naming rules, file organization, and development practices for the LAPD Central Discord bot project.  
> All contributors **must** follow these guidelines to maintain consistency across the codebase.

---

## 1. Naming Conventions

The project primarily uses **PascalCase** for most identifiers, with well-defined exceptions.

### 1.1 General Rules

| **Element**                  | **Case**   | **Example**                                |
| ---------------------------- | ---------- | ------------------------------------------ |
| **Functions (top-level)**    | PascalCase | `GetUserInfo()`, `FormatUsername()`        |
| **Variables (top-level)**    | PascalCase | `const MaxRetries = 3`                     |
| **Constants**                | PascalCase | `const API_BASE_URL` (see exception below) |
| **Parameters**               | PascalCase | `function ProcessData(InputData)`          |
| **Class / Interface / Type** | PascalCase | `class GuildProfile`, `interface Command`  |
| **File names**               | PascalCase | `AdminLinkRoblox.ts`, `Help.ts`            |
| **Test files**               | PascalCase | `Formatters.test.ts`                       |

> **Special Identifiers:**  
> - `ID` → written as `Id` in code (e.g., `UserId`, `GuildId`), `id` in object/json properties, but as `ID` in user-facing text.
> - Other acronyms (`URL`, `API`, `HTTP`) remain uppercase.

### 1.2 Exceptions to PascalCase

| **Case**                                                               | **Style**                                                                                     | **Example**                                                                             |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Extending external libraries** (e.g., discord.js classes)            | Use the library’s style                                                                       | `class MyClient extends Client { ... }` (discord.js uses camelCase for methods)         |
| **API request/response objects** (JSON)                                | lower_snake_case                                                                              | `{ user_id: "123", roblox_name: "Player" }` (unless API documentation states otherwise) |
| **Object properties** when the object’s convention is already set      | Match that object                                                                             | If an imported object uses camelCase, add `newProperty` (camelCase) to extend it.       |
| **Constants grouped in a dedicated `Constants.ts` file**               | UPPER_SNAKE_CASE                                                                              | (if that file adopts that pattern)                                                      |
| **When a function is used as a property of an object** (e.g., command) | Property name may be camelCase if required; the function definition itself remains PascalCase | `{ callback: CallbackFunction }`                                                        |

---

## 2. File and Folder Structure

### 2.1 Source Directory Layout

```mathematica
Source/
├── Main.ts                     # Entry point
├── Commands/                   # All slash commands
│   ├── CtxMenu/                # Context menu commands
│   ├── Development/            # Dev/admin commands
│   ├── Informative/            # Info commands
│   ├── Miscellaneous/          # General commands
│   └── Utility/                # Utility commands
├── Config/                     # Configuration (Secrets, Constants, Shared)
├── Events/                     # Discord.js event handlers
├── Handlers/                   # Core handlers (Express server, etc.)
├── Jobs/                       # Scheduled cron jobs
├── Models/                     # Mongoose models & schemas
├── Resources/                  # Static assets (Imgs, Fonts, HTML, Libs)
├── Typings/                    # TypeScript type definitions
└── Utilities/                  # Helper functions and classes
```

### 2.2 Command File Structure

Every command file **must** follow this section order:

```typescript
// ============================================================
// Imports
// ------------------------------------------------------------
import { SlashCommandBuilder } from "discord.js";
// ... other imports

// ============================================================
// Constants (optional)
// ------------------------------------------------------------
const MAX_RETRIES = 3;

// ============================================================
// Helper Functions (private, not exported)
// ------------------------------------------------------------
function InternalHelper() { ... }

// ============================================================
// Command Handling (callback)
// ------------------------------------------------------------
async function Callback(Interaction: SlashCommandInteraction<"cached">) {
  // ...
}

// ============================================================
// Command Structure
// ------------------------------------------------------------
const CommandObject = {
  callback: Callback,
  data: new SlashCommandBuilder()
    .setName("example")
    .setDescription("..."),
};

// ============================================================
export default CommandObject;
```

**File name** must match the command’s primary purpose (e.g., `AdminLinkRoblox.ts` for `/admin-link-roblox`).

---

## 3. Code Formatting & Linting

- **Indentation:** 2 spaces (no tabs)  
- **Line width:** 100 characters  
- **Line endings:** CRLF (Windows) – enforced by `.editorconfig`  
- **Quotes:** Double quotes for strings  
- **Semicolons:** Required  

These rules are enforced by **Prettier** and **ESLint**.  
Run `npm run lint` to check your code.

### 3.1 Linting Rules (Highlights)

- Cognitive complexity limit: 50  
- Regex complexity threshold: 30  
- Warnings for `TODO` comments  
- Comments must start with a capital letter  

---

## 4. Documentation & Comments

- **All public functions, classes, and exported types** must have a JSDoc comment:

```typescript
/**
 * Brief description of what the function does.
 * @param ParamName - Description of the parameter.
 * @returns Description of the return value.
 */
export function SomeFunction(ParamName: string) { ... }
```

- **Internal comments** should be written in full sentences with proper punctuation.
- Use `//` for inline comments; `/* */` for multi-line explanations.

---

## 5. Testing

- Tests are written with **Jest** and placed in the `Tests/` directory.  
- Test files should mirror the source file names as closely as possible:  
  `Utilities/Strings/Formatters.ts` → `Tests/Utils/Formatters.test.ts`  
- Use `npm test` to run all tests; `npm run test:utils` for utility tests.

---

## 6. Commit & Pull Request Guidelines

We follow **Conventional Commits** for PR titles and commit messages.

```dsconfig
<type>[+<type>...](<scope>): <description>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.  
Use imperative, lower-case description.

**Examples:**  
- `feat(ctx-menu): add user report context command`  
- `fix(shift-model): prevent break end on null timestamp`  
- `chore: update dependencies`

---

## 7. Additional Best Practices

- Use **async/await** over raw promises.  
- Handle errors gracefully; log with the Winston logger.  
- Prefer **early returns** to reduce nesting.  
- Always **use path aliases** (`#Utilities/*`, `#Models/*`, etc.) – they are resolved at runtime.  
- Keep functions **small and focused**; refactor into helpers when needed.

---

## 8. Exceptions & Flexibility

The rules above are **intentionally strict** but allow deviations when:

- Working with an external library that imposes a different style.
- Integrating with an existing API that uses a specific naming convention.
- Extending an object where following its existing property casing is more important than applying PascalCase.

When in doubt, **follow the pattern of the surrounding code** and add a comment if the deviation is necessary.

---

## 9. Enforcement

- **Pre-commit hooks** are not yet configured, but CI (GitHub Actions) runs `npm run lint` and `npm test` on every push and PR.  
- Failing checks will block merging.

---

This document supplements the [Contributing Guide](CONTRIBUTING.md) and [Copilot Instructions](.github/copilot-instructions.md). For further details, refer to those files.

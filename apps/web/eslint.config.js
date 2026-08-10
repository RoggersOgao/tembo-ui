import { nextJsConfig } from "@workspace/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    // 1. Define which files this restriction applies to
    // This targets common patterns for Client Components or shared files
    files: ["**/*.tsx", "**/*.ts"],
    // 2. Exclude specific directories that ARE allowed to use Prisma
    // (e.g., Server Actions, API routes, or specific server-only folders)
    ignoredFiles: ["**/app/api/**/*", "**/actions/**/*"], 
    rules: {
      "no-restricted-imports": [
        "error",
        {
          "paths": [
            {
              "name": "@repo/database",
              "message": "Prisma/Database access is restricted to Server Components and Actions. Please move this logic to a server-side file."
            }
          ]
        }
      ]
    }
  }
];
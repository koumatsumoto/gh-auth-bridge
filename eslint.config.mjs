import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist", "**/coverage", "**/*.config.ts", "**/*.config.mjs"] },
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/__tests__/**"],
    rules: {
      // Cloudflare Workers types return `any` from response.json() in ESLint's view,
      // but `unknown` in tsc's view, causing conflicting assertion requirements
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
);

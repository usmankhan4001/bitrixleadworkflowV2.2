import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["dist/**", "node_modules/**"],
    },
    {
        files: ["**/*.{js,mjs,cjs}"],
        ...js.configs.recommended,
    },
    {
        files: ["**/*.ts"],
        ...tseslint.configs.recommended[0],
        rules: {
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
            }],
        },
    }
);

import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "out/**", ".claude/**", "android/**"]
  },
  {
    // Plain Node maintenance scripts are CommonJS; require() is how they load modules.
    files: ["scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" }
  }
];

export default eslintConfig;

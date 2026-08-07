import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // These React Compiler rules flag the standard "subscribe to an
      // external store (Firebase listeners) in useEffect" pattern and
      // "read current time during render for a deadline check" pattern
      // used throughout this app's data layer, which are correct and
      // intentional here (not accidental cascading renders).
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/purity": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "functions/**"]),
]);

export default eslintConfig;

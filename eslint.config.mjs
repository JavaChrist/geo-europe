import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const nativeDialogs = ["alert", "confirm", "prompt"];
const hardcodedAttributes = "aria-label|title|alt|placeholder";
const firebaseImports = ["firebase", "firebase/*", "firebase-admin", "firebase-admin/*"];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-alert": "error",
      "no-restricted-globals": ["error", ...nativeDialogs.map((name) => ({ name, message: "Utiliser useModal()." }))],
      "no-restricted-properties": [
        "error",
        ...nativeDialogs.map((property) => ({ object: "window", property, message: "Utiliser useModal()." })),
      ],
    },
  },
  {
    files: ["src/**/*.tsx"],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true, allowedStrings: [" "] }],
      "no-restricted-syntax": [
        "error",
        {
          selector: `JSXAttribute[name.name=/^(${hardcodedAttributes})$/] > Literal[value=/./]`, // alt="" reste permis pour une image décorative.
          message: "Texte en dur interdit : passer par t().",
        },
      ],
    },
  },
  {
    // Firebase reste confiné aux services : le jeu gratuit doit tourner sans lui.
    files: ["src/**"],
    ignores: ["src/services/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: firebaseImports }],
    },
  },
  {
    // Le moteur ne connaît ni l'interface, ni les services : il doit rester réutilisable tel quel.
    files: ["src/engine/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["react", "react-dom", "next", "next/*", ...firebaseImports, "@/services/*", "@/ui/*", "@/features/*"] },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

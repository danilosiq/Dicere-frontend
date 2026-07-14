export const textColorPatterns = {
  white: { light: "text-white", dark: "dark:text-white" },
  black: { light: "text-black", dark: "dark:text-black" },
  "gray-100": { light: "text-gray-100", dark: "dark:text-gray-100" },
  "gray-200": { light: "text-gray-200", dark: "dark:text-gray-200" },
  "gray-400": { light: "text-gray-400", dark: "dark:text-gray-400" },
  "gray-600": { light: "text-gray-600", dark: "dark:text-gray-600" },
  "gray-800": { light: "text-gray-800", dark: "dark:text-gray-800" },
  "gray-900": { light: "text-gray-900", dark: "dark:text-gray-900" },
  "primary-green": {
    light: "text-primary-green",
    dark: "dark:text-primary-green",
  },
  "light-green": {
    light: "text-light-green",
    dark: "dark:text-light-green",
  },
  "primary-purple": {
    light: "text-primary-purple",
    dark: "dark:text-primary-purple",
  },
  "light-purple": {
    light: "text-light-purple",
    dark: "dark:text-light-purple",
  },
  error: { light: "text-error", dark: "dark:text-error" },
  "error-light": {
    light: "text-error-light",
    dark: "dark:text-error-light",
  },
  "error-dark": {
    light: "text-error-dark",
    dark: "dark:text-error-dark",
  },
  success: { light: "text-success", dark: "dark:text-success" },
  "success-light": {
    light: "text-success-light",
    dark: "dark:text-success-light",
  },
  "success-dark": {
    light: "text-success-dark",
    dark: "dark:text-success-dark",
  },
  info: { light: "text-info", dark: "dark:text-info" },
  "info-light": {
    light: "text-info-light",
    dark: "dark:text-info-light",
  },
  "info-dark": { light: "text-info-dark", dark: "dark:text-info-dark" },
  background: { light: "text-background", dark: "dark:text-background" },
  component: { light: "text-component", dark: "dark:text-component" },
  foreground: { light: "text-foreground", dark: "dark:text-foreground" },
  border: { light: "text-border", dark: "dark:text-border" },
  "brand-green": {
    light: "text-brand-green",
    dark: "dark:text-brand-green",
  },
  "brand-purple": {
    light: "text-brand-purple",
    dark: "dark:text-brand-purple",
  },
} as const;

export type TextColorPattern = keyof typeof textColorPatterns;

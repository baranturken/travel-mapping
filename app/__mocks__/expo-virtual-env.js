// babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` reads into an import
// from the ESM-only `expo/virtual/env` module, which Jest does not transform.
// This stub keeps a live reference to process.env so tests can set EXPO_PUBLIC_*
// values before importing the module under test.
module.exports = { env: process.env };

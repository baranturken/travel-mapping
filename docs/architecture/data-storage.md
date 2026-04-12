# Data Storage

## Local-first model

The app should save the core trip model locally first so the user can reopen and inspect saved trips without depending on constant connectivity.

## V1 split

### Supabase

- user account
- auth session
- future sync anchor

### Local storage

- trip records
- stops
- legs
- drafts
- cached geocoding results
- UI preferences where useful

## Migration rule

Keep repositories and service interfaces narrow so the source of truth can move over time without rewriting the UI.

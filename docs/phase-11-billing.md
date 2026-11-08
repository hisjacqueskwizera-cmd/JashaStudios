# Phase 11 — Payments, credits and subscriptions

## Implemented foundation
- Seeded RWF catalog: Single photograph 3,000 RWF, Standard 16,000 RWF/month and Pro 28,000 RWF/month.
- The single-photo product grants one credit after a verified payment is settled.
- Standard and Pro monthly credit allowances remain null/unset; no allowance was invented.
- Authenticated billing page shows the current credit balance, subscription, credit activity and payment history.
- Credit ledger is append-only. Corrections must be compensating entries.
- A service-role-only settlement RPC checks the expected amount and currency, is idempotent for a settled transaction, grants configured credits and activates an initial subscription period atomically.
- Payment-provider interface exists, but no provider adapter is registered. Checkout is disabled and no customer is charged.
- Provider webhook verification must happen in trusted server code before calling the settlement RPC.

## Not implemented yet
- Rwanda payment gateway selection and credentials.
- Hosted checkout/mobile-money collection and provider webhook endpoint.
- Recurring subscription billing, renewals, failed-payment recovery and cancellation at provider.
- Admin UI for product pricing and monthly credit allowances (Phase 12).
- Live Supabase migration and end-to-end provider tests.

## Apply the migration
After reviewing the SQL, apply it to staging first using the Supabase CLI:
```bash
npx supabase migration list --remote
npx supabase db push --dry-run --remote
npx supabase db push --remote
```
Never run `db reset --remote` against a database containing customer data.

## Configuration boundary
The payment provider is deliberately unconfigured. Do not add client-side code that marks a payment successful. A provider adapter must validate webhook signatures, verify the transaction with the provider, match amount/currency/reference, then call `apply_verified_payment` using server-only credentials.

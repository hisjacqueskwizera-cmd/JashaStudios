# Phase 12 — Admin dashboard

## Included
- Admin route: `/dashboard/admin`.
- Role checks use Supabase Auth `app_metadata.role === "admin"`; client-editable `user_metadata` is never trusted.
- Platform metrics: accounts, projects, captures, generated-image records, queued/running/failed jobs, successful/pending payments and recorded RWF revenue.
- Customer directory: email, name, join date, account status, project count and credit balance.
- Account suspend/reactivate controls. Suspension updates both the profile status and Supabase Auth `banned_until`.
- Billing product configuration: RWF price, one-time credits/monthly allowance and active state.
- Manual credit adjustments with reason, immutable ledger entry and audit log in one database transaction.
- Recent payment records, transformation job state and administrative audit trail.
- Admin RPCs independently validate the caller's signed `app_metadata.role` claim.

## Assign the first administrator
Apply migrations 009 and 010 to staging first. Then, from the Supabase SQL Editor as the project owner, set the trusted role on the intended administrator account. Replace the placeholder with the exact email address of the account you control:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'YOUR_ADMIN_EMAIL';
```

Sign out and sign back in to refresh the signed access token. Do not set the role in user metadata. Do not expose a role-management screen to customers. To revoke admin access, remove the `role` key from that user's `raw_app_meta_data` and refresh their session.

## Apply migrations
```bash
git pull origin main
npx supabase migration list --remote
npx supabase db push --dry-run --remote
npx supabase db push --remote
```

Review the migration output before applying. Never use `db reset --remote` on a database containing customer data.

## Important boundaries
- The console does not collect payments or trigger a real AI transformation.
- Billing gateway integration and recurring billing remain disabled.
- Monthly Standard and Pro allowances are intentionally unconfigured until approved.
- Suspending a user updates Supabase Auth's ban state and the profile status. Verify refresh/revocation behavior in staging before relying on it as a production incident-response control.
- Revenue metrics show recorded successful payment transactions, not independently reconciled bank/mobile-money settlement totals.
- The initial customer directory shows the latest 50 accounts; search and pagination are follow-up improvements.

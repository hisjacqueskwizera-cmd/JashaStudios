# Payments and monetization — deferred

Payments, subscriptions, credit purchases and payment collection are explicitly out of scope for the Jasha Studios pitch MVP.

## Current release
- No checkout or payment gateway.
- No payment API credentials.
- No payment webhooks.
- No subscription collection or renewals.
- No credit purchases or automated credit deductions.
- Customer-facing billing page and admin billing controls are removed from the application.
- Historical database migrations/tables may remain in the repository for future use; they are not part of the active product workflow.

## Future release requirements
When monetization is approved, select a Rwanda-compatible payment provider, validate its current mobile-money and card support, implement server-side webhook signature verification and idempotent settlement, and test payment reconciliation in staging before enabling customer charges.

Do not enable billing by setting an environment variable. A future implementation must be reviewed and explicitly deployed.

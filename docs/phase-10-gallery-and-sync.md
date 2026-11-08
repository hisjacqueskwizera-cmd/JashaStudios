# Phase 10 — Gallery and desktop synchronization

## Objective
Provide an authenticated, account-wide gallery for phone captures and generated outputs, with automatic desktop refresh and private media previews.

## Delivered in this increment
- Added an authenticated server action that loads the signed-in owner's capture and generated-image metadata.
- Enforces owner filters on both media tables and project lookup; existing RLS remains an additional security boundary.
- Signs each private `studio-assets` object for ten minutes. No storage paths or permanent public URLs are exposed to the browser.
- Added `/dashboard/gallery` with All, Phone captures and AI results filters, project links, image dimensions, file sizes and timestamps.
- Refreshes every ten seconds while the tab is visible, refreshes on tab visibility return, and provides a manual refresh control.
- Uses the existing database tables; no migration is required for this increment.

## Deliberate limits
- AI results appear only when trusted generation workers insert rows into `generated_images` and store the corresponding object in `studio-assets`. Phase 9 has not yet implemented that pipeline.
- This increment uses authenticated polling rather than Supabase Realtime because live database migrations, Realtime publication and production connectivity have not yet been verified.
- Signed previews expire after ten minutes. The refresh action renews them.
- Gallery listing is capped at the newest 100 combined media records. Pagination and bulk download are future improvements.

## Verification required
- Apply the existing schema and storage migrations to a staging Supabase project first.
- Verify an authenticated owner can see only their own captures and generated images.
- Verify signed URLs expire and are renewed by refresh.
- Verify a newly approved phone capture appears in the gallery without a page reload.
- Verify empty generated-image state until Phase 9 publishes an output.
- Test on desktop and mobile browsers.

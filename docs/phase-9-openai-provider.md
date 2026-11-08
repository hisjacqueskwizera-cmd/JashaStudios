# Phase 9 — OpenAI image-edit provider integration

## Provider decision
Use the OpenAI Images API edit endpoint as the first managed provider adapter. The selected default is `gpt-image-2.5-sunburst`, because the official API documentation positions Sunburst for editing workflows where precision matters. Keep the model configurable through `OPENAI_IMAGE_MODEL`; benchmark Flare and other supported models later on a consented evaluation set.

Official references:
- Image generation and editing guide: https://developers.openai.com/api/docs/guides/image-generation
- Image edit API reference: https://developers.openai.com/api/reference/resources/images/methods/edit

## Input ordering and identity policy
- Input image 1 is the customer's approved capture and the only identity source.
- Input image 2 is the reference photograph and is used for visual style, scene, lighting, shadows, framing, composition, palette and mood.
- The provider prompt explicitly prohibits transferring the reference subject's face or identity.
- Pose matching is requested only where natural and anatomically plausible.
- A generated result is never described as identity-verified. Human review remains required.

## Implemented in this increment
- Added an asynchronous OpenAI Images API adapter using HTTPX; no extra SDK dependency.
- Uses the documented `POST /v1/images/edits` endpoint with ordered image data URLs, one output, high quality, automatic sizing and WebP output.
- Sends a SHA-256 safety identifier only when supplied by a trusted server caller.
- Maps rate limits/server failures, rejected requests, network failures and timeouts to typed internal exceptions.
- Validates provider response base64 and decodes/normalizes output image bytes through the existing safe image decoder.
- Added internal `POST /v1/transform/generate` endpoint protected by the vision-service API key in production.
- Added `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL` and timeout settings. The secret is server-only and not exposed through Next.js public variables.
- Preparation endpoint now reports provider readiness based on server configuration.
- Added mocked provider tests for input ordering, model metadata, rejection, invalid payload and timeout handling.

## Deliberate limits
- This endpoint is a synchronous internal provider boundary, not yet a production customer workflow.
- It does not create or lease `processing_jobs`, debit credits, retry jobs, publish to Supabase Storage or insert `generated_images`.
- No segmentation, face-embedding comparison, identity score, relighting model or automatic artifact rejection is implemented.
- OpenAI model behavior must be evaluated with customer consent and representative images. No model can guarantee perfect identity preservation.
- Configure the API key in the Python service secret manager only. Do not put it in a browser variable, commit it, or paste it into chat.

## Verification
- CI tests mock the OpenAI HTTP response; they do not call the paid API.
- A real provider smoke test requires a rotated OpenAI API key, organization access to the selected model and explicit approval to process consented test photographs.
- The worker, storage publishing and end-to-end customer workflow remain future Phase 9 work.

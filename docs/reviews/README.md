# Deep-Dive Review Index

Reviews are generated daily per the schedule defined in [deep-dive-schedule.md](deep-dive-schedule.md).

| Day | Date | Type | Target | Status |
|-----|------|------|--------|--------|
| 001 | 2026-03-01 | Route | `POST /api/orders` — order creation + Stripe checkout initiation | Complete |
| 002 | 2026-03-02 | Route | `POST /api/stripe/webhook` — payment confirmation + order state update | Complete |
| 003 | 2026-03-03 | Route | `POST /api/admin/auth/login` — admin session creation via password credentials | Complete |
| 004 | 2026-03-03 | Route | `POST /api/orders/:id/refund` — Stripe refund execution for existing paid orders | Complete |
| 005 | 2026-03-05 | Function | `createStripeCheckoutSession()` — Stripe checkout session request construction + upstream failure handling | Complete |
| 006 | 2026-03-05 | System | Log Explorer observability audit — cross-repo logging coverage, payload quality, and API usage mapping | Complete |
| 007 | 2026-03-03 | Route | `PATCH /api/orders/:id/status` — admin order status update with inventory restoration; includes 500 LOC split plan for `coreRoutes.ts` | Complete |
| 008 | 2026-03-08 | Route | `POST /api/uploads` — admin hero image upload endpoint with R2 integration and D1 metadata updates | Complete |
| 009 | 2026-03-09 | Route | `POST /api/ai/items/generate-image` — Admin OpenAI image generation and R2 sync endpoint | Complete |

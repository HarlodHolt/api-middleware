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

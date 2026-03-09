# Order & Payment Lifecycle

Complete lifecycle of an order from cart through payment to completion or cancellation.

## Flow Diagram

```
[Cart] ──> [Checkout Form] ──> [Pre-submit Stock Check] ──> [Create Order + Reserve Stock]
                                        │                           │
                                   (fail: back to cart)        (fail: 409 insufficient_stock)
                                                                    │
                                                               [Stripe Checkout]
                                                              /        |        \
                                                         (success)  (cancel)  (expire 24h)
                                                            │         │          │
                                                     [order: paid]  [back to    [webhook:
                                                     [stock: kept]   checkout]   cancelled]
                                                                      │          [stock: restored]
                                                                 [order stays
                                                                  pending until
                                                                  expire webhook]
```

## Detailed Steps

### 1. Pre-submit Stock Validation (Storefront)

**File:** `olive_and_ivory_gifts/src/components/checkout/CheckoutPageClient.tsx:930`

Before submitting the order, the storefront calls `POST /api/checkout/validate-cart` to check stock availability. If any item is out of stock, the user is redirected back to `/cart` with a message. This is an optimistic check — not a reservation.

### 2. Order Creation (API Worker)

**File:** `olive_and_ivory_api/src/routes/core/orderWriteRoutes.ts:117`

The storefront POSTs to `/api/orders` via the signed proxy at `/api/checkout/create`.

#### 2a. Idempotency Check
If an `idempotency_key` is provided and matches an existing order, the existing order is returned with a fresh Stripe session (if the previous one expired).

#### 2b. Validation
- Required fields (customer name, email, delivery address, date, cart items)
- Delivery date range (not too early, not > 12 weeks, not Sunday)
- All collection_ids must exist and be active
- Delivery quote is calculated

#### 2c. Stock Reservation

**File:** `olive_and_ivory_api/src/routes/core/helpers/orderStockDb.ts:10`

`reserveOrderInventoryStock()` queries:
```
gift_inventory_items ──JOIN──> gifts (by collection_id)
                     ──LEFT JOIN──> inventory_stock (by inventory_id)
```

For each inventory item needed:
- Calculates `required_per_gift * order_quantity` across all cart items
- If `stock_on_hand < required` for any item → returns `409 insufficient_stock`
- Otherwise returns `UPDATE` statements that decrement `stock_on_hand`

If no inventory tables exist (no inventory tracking set up), stock checking is skipped.

#### 2d. Atomic Insert + Stock Decrement

All of the following run in a single `db.batch()` (D1 transaction):
1. `INSERT INTO order_items` (one per line item)
2. `UPDATE inventory_stock SET stock_on_hand = stock_on_hand - ? WHERE item_id = ? AND stock_on_hand >= ?` (one per inventory item)

If the batch fails, the order is rolled back (`DELETE FROM orders WHERE id = ?`).

#### 2e. Stripe Checkout Session

**File:** `olive_and_ivory_api/src/routes/core/orderWriteRoutes.ts:462`

A Stripe Checkout Session is created with:
- Individual line items (product name, quantity, unit price, image)
- Delivery fee as a separate line item
- `success_url`: `/order-confirmation?order={orderId}&session_id={CHECKOUT_SESSION_ID}`
- `cancel_url`: `/checkout?order={orderId}&payment=cancelled`
- `metadata.order_id`: for webhook correlation

The order's `payment_provider` is updated to `stripe_checkout`.

### 3. Stripe Checkout (External)

The user is redirected to `checkout.stripe.com`. Three outcomes:

#### 3a. Payment Succeeds

Stripe redirects to `success_url` → user sees order confirmation page.

Stripe fires `checkout.session.completed` webhook → API worker:
- Sets `status = 'paid'`, `payment_status = 'paid'`, `paid_at = now`
- Stock remains decremented (reserved → committed)

#### 3b. User Cancels / Clicks Back

Stripe redirects to `cancel_url` → user returns to checkout with `?payment=cancelled`.
- Checkout page shows banner: "Payment was cancelled. Your details have been saved."
- Form data is restored from sessionStorage
- Order remains `status = 'pending'` until Stripe session expires

#### 3c. Session Expires (Default: 24 hours)

Stripe fires `checkout.session.expired` webhook → API worker:
- Sets `status = 'cancelled'`, `payment_status = 'failed'`
- **Restores inventory stock** atomically (`stock_on_hand + reserved_qty`)
- Sets `order_stock_restored = 1` to prevent duplicate restoration

### 4. Payment Failure

Stripe fires `payment_intent.payment_failed` webhook → API worker:
- Sets `status = 'cancelled'`, `payment_status = 'failed'`
- **Restores inventory stock** atomically
- Sets `order_stock_restored = 1`

### 5. Admin Cancellation

**File:** `olive_and_ivory_api/src/routes/core/orderStatusRoutes.ts`

When an admin transitions an order to `cancelled`:
- Stock is restored via `restoreOrderInventoryStock()` in the same `db.batch()`
- `order_stock_restored = 1` is set to prevent duplicate restoration
- Terminal state — cannot transition away from `cancelled`

## Stock Lifecycle Summary

| Event | Stock Effect |
|---|---|
| Order created | **Decremented** (reserved) |
| Payment succeeds | No change (reserved → committed) |
| Payment fails | **Restored** |
| Checkout session expires | **Restored** |
| Admin cancels order | **Restored** |
| Order hard-deleted | Written off to `written_off_stock` table |

## Key Files

| File | Purpose |
|---|---|
| `olive_and_ivory_gifts/src/components/checkout/CheckoutPageClient.tsx` | Checkout form, pre-submit stock check, submit handler |
| `olive_and_ivory_gifts/src/app/api/checkout/create/route.ts` | Storefront proxy to API worker |
| `olive_and_ivory_api/src/routes/core/orderWriteRoutes.ts` | Order creation, validation, Stripe session |
| `olive_and_ivory_api/src/routes/core/helpers/orderStockDb.ts` | Stock reserve / restore / write-off |
| `olive_and_ivory_api/src/routes/stripe.ts` | Stripe webhook handler |
| `olive_and_ivory_api/src/routes/core/orderStatusRoutes.ts` | Admin status transitions + stock restore on cancel |

## Webhook Events

| Stripe Event | Handler Action |
|---|---|
| `checkout.session.completed` | Order → paid, stock committed |
| `checkout.session.expired` | Order → cancelled, stock restored |
| `payment_intent.succeeded` | Order → paid, stock committed |
| `payment_intent.payment_failed` | Order → cancelled, stock restored |

## Race Condition Protection

- **Atomic reservation:** Stock check + decrement runs in a single `db.batch()` (D1 SQLite transaction). Two concurrent orders for the last item will have one succeed and one fail.
- **Idempotency:** Duplicate submissions with the same `idempotency_key` return the existing order instead of creating a new one.
- **Replay protection:** Stripe webhooks are deduplicated by `stripe_event_id` to prevent double-processing.
- **Double-restore protection:** `order_stock_restored = 1` flag prevents stock from being restored twice if multiple cancel/expire events arrive.

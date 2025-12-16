# Stripe Integration Setup Guide

This document explains how to set up Stripe payments for the Rooted Voices platform.

## Environment Variables

Add these to your `.env` file in the `backend/` directory:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key (test or live)
STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key (test or live)
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook signing secret from Stripe Dashboard

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:3000
```

## Frontend Environment Variables

Add to `dummy/.env.local`:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key
NEXT_PUBLIC_API_URL=http://localhost:5001/api
```

## Stripe Dashboard Setup

1. **Create a Stripe Account**: Go to https://stripe.com and create an account
2. **Get API Keys**: 
   - Go to Developers → API keys
   - Copy your **Publishable key** and **Secret key**
   - Use test keys for development, live keys for production

3. **Set Up Webhooks**:
   - Go to Developers → Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `http://localhost:5001/api/stripe/webhook` (or your production URL)
   - Select events to listen to:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
     - `charge.refunded`
   - Copy the **Signing secret** (starts with `whsec_`)

## Payment Flows

### 1. Subscription Payments
- **Route**: `POST /api/stripe/create-checkout-session`
- **Flow**: Client selects pricing tier → Redirects to Stripe Checkout → Webhook processes subscription
- **Used for**: Monthly subscription plans (Rooted, Flourish, Bloom tiers)

### 2. Session Payments
- **Route**: `POST /api/stripe/create-payment-intent` or `POST /api/stripe/process-session-payment`
- **Flow**: Session completed → Create payment intent → Client confirms payment → Webhook processes
- **Used for**: Individual therapy session payments

### 3. SLPA Cancellation Fees
- **Route**: `POST /api/stripe/create-cancellation-payment`
- **Flow**: Patient cancels → SLPA logs cancellation → Create payment intent → Client pays $15 fee
- **Used for**: SLPA cancellation compensation

## Testing

### Test Cards (Stripe Test Mode)

Use these test card numbers in Stripe Checkout or payment forms:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Authentication**: `4000 0025 0000 3155`

Use any:
- Future expiry date (e.g., 12/34)
- Any 3-digit CVC
- Any ZIP code

### Testing Webhooks Locally

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks: `stripe listen --forward-to localhost:5001/api/stripe/webhook`
4. Copy the webhook signing secret from the CLI output

## Payment Processing Flow

### Session Payment Flow:
1. Therapist completes session → `POST /api/sessions/:id/complete`
2. Client clicks "Pay" button → `POST /api/stripe/process-session-payment`
3. Payment intent created → Client enters card details
4. Payment confirmed → Webhook `payment_intent.succeeded` fires
5. Payment record updated → Session marked as paid

### SLPA Cancellation Flow:
1. Patient cancels session → `DELETE /api/sessions/:id` with `loggedByTherapist: true`
2. SLPA logs cancellation → Payment record created with $15 fee
3. Client clicks "Pay Cancellation Fee" → `POST /api/stripe/create-cancellation-payment`
4. Payment processed → Webhook updates payment status

## Admin Panel

Admins can:
- View all payments in `/payments` page
- Process refunds via `POST /api/stripe/refund`
- Configure payment split (platform fee %) in `/payment-split`
- Configure rate caps in `/rate-caps`

## Security Notes

1. **Never expose secret keys** in frontend code
2. **Always verify webhook signatures** (already implemented)
3. **Use HTTPS in production** for webhook endpoints
4. **Store customer IDs** in database for future payments (optional optimization)
5. **Handle idempotency** for payment intents (prevents duplicate charges)

## Production Checklist

- [ ] Switch to live Stripe keys
- [ ] Update webhook endpoint URL in Stripe Dashboard
- [ ] Test all payment flows
- [ ] Set up error monitoring
- [ ] Configure email notifications for failed payments
- [ ] Set up automatic retries for failed payments
- [ ] Test refund functionality
- [ ] Verify PCI compliance requirements

## Troubleshooting

### Webhook not receiving events
- Check webhook endpoint URL is correct
- Verify webhook secret matches
- Check server logs for errors
- Use Stripe CLI to test webhooks locally

### Payment intent not confirming
- Check client secret is valid
- Verify card details are correct
- Check Stripe Dashboard for error messages
- Ensure payment method is attached

### Refunds not processing
- Verify charge ID exists
- Check refund amount doesn't exceed original charge
- Ensure admin role is required (already implemented)


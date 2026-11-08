/**
 * Payment-provider boundary for Jasha Studios.
 *
 * No gateway is enabled yet. Do not mark a transaction successful from the browser.
 * A future provider adapter must verify webhook signatures and query provider-side
 * transaction status before calling the server-only settlement RPC.
 */
export type CheckoutRequest = {
  paymentId: string;
  productCode: string;
  amountRwf: number;
  currency: "RWF";
  customerId: string;
};

export type CheckoutSession = {
  providerReference: string;
  checkoutUrl: string;
  expiresAt: string;
};

export interface PaymentProvider {
  readonly code: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<{
    eventId: string;
    paymentId: string;
    providerReference: string;
    amountRwf: number;
    currency: "RWF";
  }>;
}

/**
 * Intentionally returns null until a supported Rwanda-compatible provider has
 * been selected, credentials configured server-side, and its webhook verified.
 */
export function getPaymentProvider(): PaymentProvider | null {
  return null;
}

export function getPaymentProviderStatus(): "not_configured" {
  return "not_configured";
}

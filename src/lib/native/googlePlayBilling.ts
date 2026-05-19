import { registerPlugin } from "@capacitor/core";

export interface GooglePlayProduct {
  productId: string;
  title: string;
  description: string;
  formattedPrice?: string;
  priceAmountMicros?: number;
  priceCurrencyCode?: string;
  offerToken?: string;
  purchaseOptionId?: string;
}

export interface GooglePlayPurchase {
  productIds: string[];
  purchaseToken: string;
  orderId?: string;
  packageName?: string;
  purchaseTime?: number;
  purchaseState: "PURCHASED" | "PENDING" | "UNSPECIFIED";
  acknowledged?: boolean;
  quantity?: number;
}

export interface GooglePlayBillingPlugin {
  queryProducts(options: {
    productIds: string[];
  }): Promise<{ products: GooglePlayProduct[] }>;
  purchase(options: {
    productId: string;
    obfuscatedAccountId?: string;
  }): Promise<{ purchases: GooglePlayPurchase[] }>;
  queryPurchases(): Promise<{ purchases: GooglePlayPurchase[] }>;
  consumePurchase(options: { purchaseToken: string }): Promise<{
    purchaseToken: string;
  }>;
}

export const GooglePlayBilling =
  registerPlugin<GooglePlayBillingPlugin>("GooglePlayBilling");

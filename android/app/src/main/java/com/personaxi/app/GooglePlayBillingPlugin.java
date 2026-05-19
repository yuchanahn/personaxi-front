package com.personaxi.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "GooglePlayBilling")
public class GooglePlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;
    private Handler mainHandler;
    private boolean isConnecting = false;
    private final List<ReadyCallback> readyCallbacks = new ArrayList<>();
    private PluginCall pendingPurchaseCall;

    private interface ReadyCallback {
        void onReady();
        void onError(BillingResult result);
    }

    @Override
    public void load() {
        mainHandler = new Handler(Looper.getMainLooper());
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .enableAutoServiceReconnection()
            .build();
    }

    @PluginMethod
    public void queryProducts(PluginCall call) {
        JSArray productIds = call.getArray("productIds");
        if (productIds == null || productIds.length() == 0) {
            call.reject("ERR_NO_PRODUCT_IDS");
            return;
        }

        withBillingClient(call, new ReadyCallback() {
            @Override
            public void onReady() {
                List<QueryProductDetailsParams.Product> products = new ArrayList<>();
                for (int i = 0; i < productIds.length(); i++) {
                    String productId = productIds.optString(i, "");
                    if (productId.isEmpty()) {
                        continue;
                    }

                    products.add(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build());
                }

                if (products.isEmpty()) {
                    call.reject("ERR_NO_PRODUCT_IDS");
                    return;
                }

                QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(products)
                    .build();

                billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
                    if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        rejectBilling(call, "ERR_QUERY_PRODUCTS", billingResult);
                        return;
                    }

                    JSArray items = new JSArray();
                    for (ProductDetails details : productDetailsResult.getProductDetailsList()) {
                        items.put(productToJSObject(details));
                    }

                    JSObject response = new JSObject();
                    response.put("products", items);
                    call.resolve(response);
                });
            }

            @Override
            public void onError(BillingResult result) {
                rejectBilling(call, "ERR_BILLING_UNAVAILABLE", result);
            }
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", "");
        if (productId.isEmpty()) {
            call.reject("ERR_PRODUCT_ID_REQUIRED");
            return;
        }

        if (pendingPurchaseCall != null) {
            call.reject("ERR_PURCHASE_IN_PROGRESS");
            return;
        }

        withBillingClient(call, new ReadyCallback() {
            @Override
            public void onReady() {
                QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build();
                QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(Collections.singletonList(product))
                    .build();

                billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsResult) -> {
                    if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        rejectBilling(call, "ERR_QUERY_PRODUCT", billingResult);
                        return;
                    }

                    List<ProductDetails> detailsList = productDetailsResult.getProductDetailsList();
                    if (detailsList.isEmpty()) {
                        call.reject("ERR_PRODUCT_NOT_AVAILABLE");
                        return;
                    }

                    ProductDetails details = detailsList.get(0);
                    ProductDetails.OneTimePurchaseOfferDetails offer = firstOffer(details);
                    BillingFlowParams.ProductDetailsParams.Builder detailsParams =
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(details);

                    if (offer != null && offer.getOfferToken() != null && !offer.getOfferToken().isEmpty()) {
                        detailsParams.setOfferToken(offer.getOfferToken());
                    }

                    BillingFlowParams.Builder flowParams = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(Collections.singletonList(detailsParams.build()));

                    String obfuscatedAccountId = call.getString("obfuscatedAccountId", "");
                    if (!obfuscatedAccountId.isEmpty()) {
                        flowParams.setObfuscatedAccountId(obfuscatedAccountId);
                    }

                    Activity activity = getActivity();
                    if (activity == null) {
                        call.reject("ERR_ACTIVITY_UNAVAILABLE");
                        return;
                    }

                    pendingPurchaseCall = call;
                    BillingResult launchResult = billingClient.launchBillingFlow(activity, flowParams.build());
                    if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        pendingPurchaseCall = null;
                        rejectBilling(call, "ERR_LAUNCH_BILLING_FLOW", launchResult);
                    }
                });
            }

            @Override
            public void onError(BillingResult result) {
                rejectBilling(call, "ERR_BILLING_UNAVAILABLE", result);
            }
        });
    }

    @PluginMethod
    public void queryPurchases(PluginCall call) {
        withBillingClient(call, new ReadyCallback() {
            @Override
            public void onReady() {
                QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build();

                billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
                    if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        rejectBilling(call, "ERR_QUERY_PURCHASES", billingResult);
                        return;
                    }

                    JSObject response = new JSObject();
                    response.put("purchases", purchasesToJSArray(purchases));
                    call.resolve(response);
                });
            }

            @Override
            public void onError(BillingResult result) {
                rejectBilling(call, "ERR_BILLING_UNAVAILABLE", result);
            }
        });
    }

    @PluginMethod
    public void consumePurchase(PluginCall call) {
        String purchaseToken = call.getString("purchaseToken", "");
        if (purchaseToken.isEmpty()) {
            call.reject("ERR_PURCHASE_TOKEN_REQUIRED");
            return;
        }

        withBillingClient(call, new ReadyCallback() {
            @Override
            public void onReady() {
                ConsumeParams params = ConsumeParams.newBuilder()
                    .setPurchaseToken(purchaseToken)
                    .build();

                billingClient.consumeAsync(params, (billingResult, token) -> {
                    if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        rejectBilling(call, "ERR_CONSUME_PURCHASE", billingResult);
                        return;
                    }

                    JSObject response = new JSObject();
                    response.put("purchaseToken", token);
                    call.resolve(response);
                });
            }

            @Override
            public void onError(BillingResult result) {
                rejectBilling(call, "ERR_BILLING_UNAVAILABLE", result);
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;
        if (call == null) {
            return;
        }

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            JSObject response = new JSObject();
            response.put("purchases", purchasesToJSArray(purchases));
            call.resolve(response);
            return;
        }

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.reject("ERR_USER_CANCELED");
            return;
        }

        rejectBilling(call, "ERR_PURCHASE_FAILED", billingResult);
    }

    private void withBillingClient(PluginCall call, ReadyCallback callback) {
        mainHandler.post(() -> {
            if (billingClient == null) {
                load();
            }

            if (billingClient.isReady()) {
                callback.onReady();
                return;
            }

            readyCallbacks.add(callback);
            if (isConnecting) {
                return;
            }

            isConnecting = true;
            billingClient.startConnection(new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(BillingResult billingResult) {
                    isConnecting = false;
                    List<ReadyCallback> callbacks = new ArrayList<>(readyCallbacks);
                    readyCallbacks.clear();

                    for (ReadyCallback readyCallback : callbacks) {
                        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                            readyCallback.onReady();
                        } else {
                            readyCallback.onError(billingResult);
                        }
                    }
                }

                @Override
                public void onBillingServiceDisconnected() {
                    isConnecting = false;
                }
            });
        });
    }

    private JSObject productToJSObject(ProductDetails details) {
        ProductDetails.OneTimePurchaseOfferDetails offer = firstOffer(details);
        JSObject item = new JSObject();
        item.put("productId", details.getProductId());
        item.put("title", details.getTitle());
        item.put("description", details.getDescription());

        if (offer != null) {
            item.put("formattedPrice", offer.getFormattedPrice());
            item.put("priceAmountMicros", offer.getPriceAmountMicros());
            item.put("priceCurrencyCode", offer.getPriceCurrencyCode());
            item.put("offerToken", offer.getOfferToken());
            item.put("purchaseOptionId", offer.getPurchaseOptionId());
        }

        return item;
    }

    private ProductDetails.OneTimePurchaseOfferDetails firstOffer(ProductDetails details) {
        List<ProductDetails.OneTimePurchaseOfferDetails> offers = details.getOneTimePurchaseOfferDetailsList();
        if (offers != null && !offers.isEmpty()) {
            return offers.get(0);
        }

        return details.getOneTimePurchaseOfferDetails();
    }

    private JSArray purchasesToJSArray(List<Purchase> purchases) {
        JSArray items = new JSArray();
        if (purchases == null) {
            return items;
        }

        for (Purchase purchase : purchases) {
            items.put(purchaseToJSObject(purchase));
        }

        return items;
    }

    private JSObject purchaseToJSObject(Purchase purchase) {
        JSObject item = new JSObject();
        item.put("productIds", listToJSArray(purchase.getProducts()));
        item.put("purchaseToken", purchase.getPurchaseToken());
        item.put("orderId", purchase.getOrderId());
        item.put("packageName", purchase.getPackageName());
        item.put("purchaseTime", purchase.getPurchaseTime());
        item.put("purchaseState", purchaseStateToString(purchase.getPurchaseState()));
        item.put("acknowledged", purchase.isAcknowledged());
        item.put("quantity", purchase.getQuantity());
        return item;
    }

    private JSArray listToJSArray(List<String> values) {
        JSArray items = new JSArray();
        if (values == null) {
            return items;
        }

        for (String value : values) {
            items.put(value);
        }

        return items;
    }

    private String purchaseStateToString(int purchaseState) {
        if (purchaseState == Purchase.PurchaseState.PURCHASED) {
            return "PURCHASED";
        }
        if (purchaseState == Purchase.PurchaseState.PENDING) {
            return "PENDING";
        }
        return "UNSPECIFIED";
    }

    private void rejectBilling(PluginCall call, String code, BillingResult result) {
        String message = code + ": " + result.getResponseCode() + " " + result.getDebugMessage();
        call.reject(message);
    }
}

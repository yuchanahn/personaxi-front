import { writable } from "svelte/store";
import { api } from "$lib/api";

export interface PricingPolicy {
    costs: { [key: string]: number };
    model_multipliers: { [key: string]: number };
    purchase_options: PurchaseOption[];
}

export interface PurchaseOption {
    neurons: number;
    price_krw: number;
    price_display: string;
    item_id: string;
    bonus_ratio?: number;
}

const defaultPolicy: PricingPolicy = {
    costs: {
        chat_2d: 5,
        chat_3d: 10,
        chat_live2d: 10,
        image_generation: 10
    },
    model_multipliers: {
        "gemini-flash-lite": 1.0,
        "gemini-pro": 2.0
    },
    purchase_options: [
        { neurons: 1000, price_krw: 1200, price_display: "₩1,200", item_id: "neuron_1000" },
        { neurons: 5500, price_krw: 5900, price_display: "₩5,900", item_id: "neuron_5500" },
        { neurons: 12000, price_krw: 12000, price_display: "₩12,000", item_id: "neuron_12000" }
    ]
};

function createPricingStore() {
    const { subscribe, set, update } = writable<PricingPolicy>(defaultPolicy);

    return {
        subscribe,
        fetchPricingPolicy: async () => {
            try {
                if (!await api.isLoggedIn()) {
                    return;
                }

                const res = await api.get("/api/policy/pricing");
                if (res.ok) {
                    const data = await res.json();
                    set(data);
                }
            } catch (err) {
                console.error("Failed to fetch pricing policy, using default:", err);
            }
        },
        getCost: (type: string) => {
            // Helper to get cost from store value
            // Note: Since this is a store, using get(pricingStore) inside components is better.
            // But this method works if we access the internal state or if we assume components subscribe.
            // Just returning the store itself is enough.
        }
    };
}

export const pricingStore = createPricingStore();

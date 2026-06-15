import { writable } from "svelte/store";
import { api } from "$lib/api";

export interface ModelConfig {
    id: string;
    name: string;
    provider: string;
    description: string;
    icon: string;
    color: string;
    input_cost_per_1k: number; // in Micro-neurons
    output_cost_per_1k: number; // in Micro-neurons
    is_active: boolean;
}

export interface PricingPolicy {
    billing_mode?: string; // "fixed" | "token"
    costs: { [key: string]: number };
    model_multipliers: { [key: string]: number };
    purchase_options: PurchaseOption[];
    token_pricing?: {
        [model: string]: {
            input_cost_per_1k: number;
            output_cost_per_1k: number;
        }
    };
    available_models?: ModelConfig[];
}

export interface PurchaseOption {
    neurons: number;
    prices: Record<string, number>;
    item_id: string;
    android_product_id?: string;
    bonus_ratio?: number;
    bonus_amount?: number;
}

const defaultPolicy: PricingPolicy = {
    billing_mode: "fixed",
    costs: {
        chat_2d: 5,
        chat_3d: 10,
        chat_live2d: 10,
        image_generation: 10
    },
    model_multipliers: {
        "gemini-flash": 1.5,
        "gemini-flash-lite": 1.0,
        "gemini-pro": 2.0,
        "antigravity": 2.0
    },
    purchase_options: [],
    token_pricing: {
        "gemini-flash-lite": { input_cost_per_1k: 1000000, output_cost_per_1k: 3000000 },
        "gemini-flash": { input_cost_per_1k: 2000000, output_cost_per_1k: 6000000 },
        "gemini-pro": { input_cost_per_1k: 5000000, output_cost_per_1k: 15000000 },
        "antigravity": { input_cost_per_1k: 5000000, output_cost_per_1k: 15000000 }
    },
    available_models: [
        {
            id: "google/gemini-2.5-flash-lite",
            name: "Gemini 2.5 Flash Lite",
            provider: "Google",
            description: "Fast, efficient, and cost-effective.",
            icon: "ph:lightning-fill",
            color: "#fbbf24",
            input_cost_per_1k: 1000000,
            output_cost_per_1k: 3000000,
            is_active: true
        },
        {
            id: "google/gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            provider: "Google",
            description: "Balanced performance for most tasks.",
            icon: "ph:lightning-bold",
            color: "#a855f7",
            input_cost_per_1k: 2000000,
            output_cost_per_1k: 6000000,
            is_active: true
        },
        {
            id: "google/gemini-2.5-pro",
            name: "Gemini 2.5 Pro",
            provider: "Google",
            description: "High reasoning capability and precision.",
            icon: "ph:brain-fill",
            color: "#60a5fa",
            input_cost_per_1k: 5000000,
            output_cost_per_1k: 15000000,
            is_active: true
        },
        {
            id: "meta-llama/llama-3.1-70b-instruct",
            name: "Llama 3.1 70B",
            provider: "Meta",
            description: "State-of-the-art open source model via OpenRouter.",
            icon: "ph:chat-circle-dots-bold",
            color: "#10b981",
            input_cost_per_1k: 3000000,
            output_cost_per_1k: 9000000,
            is_active: true
        },
        {
            id: "deepseek/deepseek-chat",
            name: "DeepSeek V3",
            provider: "DeepSeek",
            description: "Highly efficient DeepSeek model via OpenRouter.",
            icon: "ph:code-bold",
            color: "#3b82f6",
            input_cost_per_1k: 1500000,
            output_cost_per_1k: 4500000,
            is_active: true
        }
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
            // Helper method
        }
    };
}

export const pricingStore = createPricingStore();

type ResizeMode = "cover" | "contain" | "fill";

interface SupabaseImageTransformOptions {
    width?: number;
    height?: number;
    quality?: number;
    resize?: ResizeMode;
}

const OBJECT_PUBLIC_SEGMENT = "/storage/v1/object/public/";
const RENDER_PUBLIC_SEGMENT = "/storage/v1/render/image/public/";
const IMAGE_TRANSFORM_PARAMS = ["width", "height", "quality", "resize", "format"];
const FALLBACK_ORIGIN = "https://personaxi.com";

export function getOptimizedSupabaseImageUrl(
    url: string | undefined,
    options: SupabaseImageTransformOptions = {},
): string {
    if (!url || url.startsWith("blob:") || url.startsWith("data:")) {
        return url || "";
    }

    const normalized = url.trim();
    if (!normalized.includes(OBJECT_PUBLIC_SEGMENT)) {
        return normalized;
    }

    try {
        const parsed = new URL(
            normalized,
            typeof window !== "undefined"
                ? window.location.origin
                : FALLBACK_ORIGIN,
        );
        parsed.pathname = parsed.pathname.replace(
            OBJECT_PUBLIC_SEGMENT,
            RENDER_PUBLIC_SEGMENT,
        );

        if (options.width) parsed.searchParams.set("width", `${options.width}`);
        if (options.height) {
            parsed.searchParams.set("height", `${options.height}`);
        }
        if (options.quality) {
            parsed.searchParams.set("quality", `${options.quality}`);
        }
        if (options.resize && options.height) {
            parsed.searchParams.set("resize", options.resize);
        }

        return parsed.toString();
    } catch {
        return normalized;
    }
}

export function getOriginalSupabaseImageUrl(url: string | undefined): string {
    if (!url || url.startsWith("blob:") || url.startsWith("data:")) {
        return url || "";
    }

    const normalized = url.trim();
    if (!normalized.includes(RENDER_PUBLIC_SEGMENT)) {
        return normalized;
    }

    try {
        const parsed = new URL(
            normalized,
            typeof window !== "undefined"
                ? window.location.origin
                : FALLBACK_ORIGIN,
        );
        parsed.pathname = parsed.pathname.replace(
            RENDER_PUBLIC_SEGMENT,
            OBJECT_PUBLIC_SEGMENT,
        );

        for (const param of IMAGE_TRANSFORM_PARAMS) {
            parsed.searchParams.delete(param);
        }

        return parsed.toString();
    } catch {
        return normalized;
    }
}

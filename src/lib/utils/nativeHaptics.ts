import { Haptics } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

function isNativeAndroid() {
    return (
        Capacitor.isNativePlatform() &&
        Capacitor.getPlatform() === "android"
    );
}

export async function triggerNativeSelectionHaptic() {
    if (!isNativeAndroid()) {
        return;
    }

    try {
        await Haptics.selectionChanged();
    } catch {
        // Ignore haptics failures so input stays instant.
    }
}

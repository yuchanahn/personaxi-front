// Simple XOR encryption/decryption for frontend asset obfuscation.
// This is NOT mathematically secure cryptography, but acts as a deterrent
// against casual theft of Live2D and VRM assets from the public bucket.

const SECRET_KEY = "PXI-LIVE2D-VRM-SECURE-KEY-2026";

/**
 * Applies a simple XOR mask to an ArrayBuffer using the secret key.
 * This function is symmetric (running it twice with the same key restores the original data).
 * @param buffer The original ArrayBuffer to encrypt/decrypt.
 * @returns A new ArrayBuffer containing the XOR-masked data.
 */
export async function xorEncryptDecrypt(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    const view = new Uint8Array(buffer);
    const keyBytes = new TextEncoder().encode(SECRET_KEY);
    const keyLen = keyBytes.length;

    // We create a new buffer to avoid mutating the original in place if it's used elsewhere
    const newBuffer = new ArrayBuffer(view.length);
    const newView = new Uint8Array(newBuffer);

    for (let i = 0; i < view.length; i++) {
        newView[i] = view[i] ^ keyBytes[i % keyLen];
    }

    return newBuffer;
}

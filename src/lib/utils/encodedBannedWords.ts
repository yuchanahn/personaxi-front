
// 비밀 키 (런타임용)
const K = 119;

export const encodedHardList = [
    "m+Lzm8Xa",
    "GZzF/5zH3g==",
    "m9bHncbDnND7nPXf",
    "m+znm9bHncLnm9fr",
    "m/XDm+rPm+//ncTX",
    "m+nnm/XDnMfenMXi",
    "FB8eGxMHGAUZ",
    "BxITGAcfHhseFg==",
    "GR4QEBIF",
    "ERYQEBgD",
    "GRYNHg==",
    "Hx4DGxIF",
    "BBkCERE=",
    "FRIfEhYTHhkQ",
    "kvLnkNzSlPTqlPTclPT5",
    "kvLnkNzSn8XAke/S",
    "kdnNktnEk83/kub9",
    "kP/xkNfDk83/kub9",
    "nuDwlPTnlPXTlPT/"
];
export const encodedSoftList = [
    "nMTDm9D3",
    "m+nnm9D3",
    "m+POmvvj",
    "m+LLnPju",
    "ncfincfz",
    "nOHLm+PO",
    "nP3Sm+3i",
    "mvjbnNLDnPLP",
    "BxgFGQ==",
    "Dw8P",
    "HxIZAxYe",
    "FRsYAB0YFQ==",
    "ExISBwMfBRgWAw==",
    "HxYZEx0YFQ==",
    "ERIDHgQf",
    "FRMEGg==",
    "lPb9lPbJlPXklPbk",
    "lPbWlPXklPbk",
    "lPXzlPX9lPbJlPXk",
    "k8/akvDNlPbg",
    "k87Gk83T",
    "lPTilPXQlPTe"
];

// 안전한 디코딩 함수
// 안전한 디코딩 함수 (Browser Compatible)
export const decodeSafe = (encoded: string) => {
    try {
        const binaryString = atob(encoded);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // XOR Decryption
        const decodedBytes = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
            decodedBytes[i] = bytes[i] ^ K;
        }

        return new TextDecoder().decode(decodedBytes);
    } catch (e) {
        console.error("Decoding failed", e);
        return "";
    }
};

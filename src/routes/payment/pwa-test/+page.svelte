<script lang="ts">
    import { onMount } from "svelte";
    import { v4 as uuidv4 } from "uuid";

    let isPWA = false;
    let bridgeUrl = "";

    onMount(() => {
        // @ts-ignore
        isPWA =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true;

        const params = new URLSearchParams({
            paymentId: `test_${Date.now()}`, // Dummy Test ID
            amount: "1000",
            credits: "100",
            productName: "Test Product (100 Neurons)",
            userId: "test-user-id",
            email: "test@example.com",
            name: "Test User",
        });
        bridgeUrl = `/payment/bridge?${params.toString()}`;
    });

    function handleWindowOpen() {
        const win = window.open(bridgeUrl, "_blank");
        if (!win || win.closed || typeof win.closed === "undefined") {
            alert("Popup blocked! window.open failed.");
        } else {
            // alert("window.open called successfully. Check if it opened in System Browser.");
        }
    }
</script>

<div class="test-container">
    <h1>PWA Payment Test</h1>

    <div class="status">
        <p>
            Environment: <strong
                >{isPWA ? "PWA (Standalone)" : "Browser"}</strong
            >
        </p>
    </div>

    <div class="test-case">
        <h3>Method 1: window.open (Current Logic)</h3>
        <p>This often fails in PWA or opens inside the app.</p>
        <button on:click={handleWindowOpen}> Try window.open </button>
    </div>

    <div class="test-case recommended">
        <h3>Method 2: Anchor Link (Same Domain)</h3>
        <p>This often fails if scope captures it (Current Issue).</p>
        <a href={bridgeUrl} target="_blank" class="link-btn">
            Test Internal Link (/payment/bridge)
        </a>
    </div>

    <div class="test-case external">
        <h3>Method 3: External Link (Subdomain Simulation)</h3>
        <p>
            <strong>Proposed Fix:</strong> Testing if a
            <em>different domain</em> opens Safari.
        </p>
        <div class="btn-group">
            <a
                href="https://google.com"
                target="_blank"
                class="link-btn success"
            >
                Test Google.com
            </a>
            <a
                href="https://github.com"
                target="_blank"
                class="link-btn success"
            >
                Test GitHub.com
            </a>
        </div>
        <p class="small-note">
            If these open in Safari, then moving payment to <code
                >pay.personaxi.com</code
            > will work!
        </p>
    </div>

    <div class="note">
        <p>
            <strong>Note:</strong> After clicking, if the bridge page opens in Chrome/Safari
            (not inside this app), then Method 2 is the solution.
        </p>
    </div>
</div>

<style>
    .test-container {
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
        font-family: sans-serif;
        color: white; /* Assuming dark theme */
    }
    h1 {
        border-bottom: 1px solid #444;
        padding-bottom: 10px;
    }
    .status {
        background: #333;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 20px;
    }
    .test-case {
        background: #222;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        border: 1px solid #444;
    }
    .test-case.recommended {
        border-color: #ff9900; /* Orange for "Attempt" */
        background: #332200;
    }
    .test-case.external {
        border-color: #00ff00; /* Green for "Solution" */
        background: #002200;
    }
    .btn-group {
        display: flex;
        gap: 10px;
        margin-top: 10px;
    }
    button,
    .link-btn {
        display: inline-block;
        padding: 12px 24px;
        background: #444;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 1rem;
        text-align: center;
    }
    .link-btn {
        background: #0070f3;
    }
    .link-btn.success {
        background: #28a745;
    }
    .small-note {
        font-size: 0.85rem;
        color: #ccc;
        margin-top: 10px;
    }
    .note {
        font-size: 0.9rem;
        color: #aaa;
        margin-top: 20px;
    }
</style>

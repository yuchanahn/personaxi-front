<script lang="ts">
    import { onMount, tick } from "svelte";
    import Icon from "@iconify/svelte";

    // --- Types ---
    type NodeType = "text" | "parameter" | "conditional" | "function";

    interface NodeData {
        id: string;
        type: NodeType;
        x: number;
        y: number;
        width: number;
        height: number;
        label: string;
        content: string;
        inputs: { id: string; label: string }[];
        outputs: { id: string; label: string }[];
        // Cache height for geometry if needed, or rely on DOM
    }

    interface Connection {
        id: string;
        fromNodeId: string;
        fromSocketId: string;
        toNodeId: string;
        toSocketId: string;
    }

    // --- State ---
    let nodes: NodeData[] = [];
    let connections: Connection[] = [];
    let nextId = 1;

    // ... State ...
    let draggingNodeId: string | null = null;
    let resizingNodeId: string | null = null;
    let editingNodeId: string | null = null; // New state for renaming
    let dragOffset = { x: 0, y: 0 };
    let resizeStart = { w: 0, h: 0, x: 0, y: 0 };

    function startEditingLabel(e: MouseEvent, nodeId: string) {
        e.stopPropagation();
        e.preventDefault();
        editingNodeId = nodeId;
    }

    // Custom action to ensure focus works immediately
    function focus(el: HTMLInputElement) {
        el.focus();
    }

    function stopEditingLabel() {
        editingNodeId = null;
    }

    function handleLabelInputKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            stopEditingLabel();
        }
    }

    // Canvas panning/zooming
    let canvasX = 0;
    let canvasY = 0;
    let scale = 1;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    // Connection creation
    let connectingFrom: {
        nodeId: string;
        socketId: string;
        x: number;
        y: number;
    } | null = null;
    let mousePos = { x: 0, y: 0 };

    // --- Element Refs ---
    let canvasRef: HTMLDivElement;

    // --- Mock Data Initialization ---
    onMount(() => {
        addNode("text", 100, 100, "Start Greeting");
        addNode("parameter", 100, 350, "User Name");
        addNode("function", 450, 200, "Combine");
        addNode("text", 800, 200, "Final Output");
    });

    // --- Actions ---

    function addNode(type: NodeType, x: number, y: number, label?: string) {
        const id = `node_${nextId++}`;
        const newNode: NodeData = {
            id,
            type,
            x,
            y,
            width: 220, // Default width
            height: type === "text" ? 150 : 120, // Default height
            label: label || type.toUpperCase(),
            content:
                type === "text"
                    ? "Hello world"
                    : type === "parameter"
                      ? "{{user}}"
                      : "",
            inputs: [],
            outputs: [],
        };

        if (type === "text") {
            newNode.inputs = [{ id: `in_0`, label: "Prepend" }];
            newNode.outputs = [{ id: `out_0`, label: "Out" }];
        } else if (type === "parameter") {
            newNode.outputs = [{ id: `out_0`, label: "Value" }];
        } else if (type === "function") {
            newNode.inputs = [
                { id: `in_a`, label: "A" },
                { id: `in_b`, label: "B" },
            ];
            newNode.outputs = [{ id: `out_0`, label: "Result" }];
        } else if (type === "conditional") {
            newNode.inputs = [{ id: `in_cond`, label: "Condition" }];
            newNode.outputs = [
                { id: `out_true`, label: "True" },
                { id: `out_false`, label: "False" },
            ];
        }

        nodes = [...nodes, newNode];
    }

    // --- Global Event Handlers ---
    function handleGlobalMouseMove(e: MouseEvent) {
        if (!canvasRef) return;

        const rect = canvasRef.getBoundingClientRect();
        mousePos = {
            x: (e.clientX - rect.left) / scale - canvasX / scale,
            y: (e.clientY - rect.top) / scale - canvasY / scale,
        };

        if (draggingNodeId) {
            nodes = nodes.map((n) => {
                if (n.id === draggingNodeId) {
                    return {
                        ...n,
                        x: e.clientX / scale - dragOffset.x,
                        y: e.clientY / scale - dragOffset.y,
                    };
                }
                return n;
            });
        } else if (resizingNodeId) {
            // Handle Resize
            const dx = (e.clientX - resizeStart.x) / scale;
            const dy = (e.clientY - resizeStart.y) / scale;

            nodes = nodes.map((n) => {
                if (n.id === resizingNodeId) {
                    return {
                        ...n,
                        width: Math.max(150, resizeStart.w + dx),
                        height: Math.max(100, resizeStart.h + dy),
                    };
                }
                return n;
            });
        } else if (isPanning) {
            canvasX += e.clientX - panStart.x;
            canvasY += e.clientY - panStart.y;
            panStart = { x: e.clientX, y: e.clientY };
        }
    }

    function handleGlobalMouseUp() {
        draggingNodeId = null;
        resizingNodeId = null;
        isPanning = false;

        // Always cancel connection drag on global mouse up
        // This fixes the "sticky" bug if you release outside a valid target
        connectingFrom = null;
    }

    // --- Node Interaction ---
    function handleMouseDownHeader(e: MouseEvent, nodeId: string) {
        e.stopPropagation();
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
            draggingNodeId = nodeId;
            dragOffset = {
                x: e.clientX / scale - node.x,
                y: e.clientY / scale - node.y,
            };
        }
    }

    function handleMouseDownResize(e: MouseEvent, nodeId: string) {
        e.stopPropagation();
        e.preventDefault(); // Prevent text selection
        resizingNodeId = nodeId;
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
            resizeStart = {
                w: node.width,
                h: node.height,
                x: e.clientX,
                y: e.clientY,
            };
        }
    }

    function handleMouseDownCanvas(e: MouseEvent) {
        // Only pan if background is clicked
        if (
            e.target === canvasRef ||
            (e.target as HTMLElement).closest(".connections-layer")
        ) {
            isPanning = true;
            panStart = { x: e.clientX, y: e.clientY };
        }
    }

    // --- Socket Interaction ---

    function startConnection(e: MouseEvent, nodeId: string, socketId: string) {
        e.stopPropagation();
        e.preventDefault();

        // Use DOM for exact start position
        const pos = getSocketDomPos(nodeId, socketId);
        if (pos) {
            connectingFrom = {
                nodeId,
                socketId,
                x: pos.x,
                y: pos.y,
            };
        }
    }

    function endConnection(e: MouseEvent, nodeId: string, socketId: string) {
        e.stopPropagation();

        if (connectingFrom && connectingFrom.nodeId !== nodeId) {
            // Check if connection already exists
            const exists = connections.some(
                (c) =>
                    c.fromNodeId === connectingFrom!.nodeId &&
                    c.fromSocketId === connectingFrom!.socketId &&
                    c.toNodeId === nodeId &&
                    c.toSocketId === socketId,
            );

            if (!exists) {
                // Constraint: Input sockets can only have ONE connection.
                // If we are connecting to an Input (which endConnection implies, as we drag From Output To Input),
                // we must remove any existing connection where toNodeId/toSocketId matches current target.

                // Remove any existing connection to this specific Input socket
                connections = connections.filter(
                    (c) =>
                        !(c.toNodeId === nodeId && c.toSocketId === socketId),
                );

                connections = [
                    ...connections,
                    {
                        id: `conn_${Date.now()}`,
                        fromNodeId: connectingFrom.nodeId,
                        fromSocketId: connectingFrom.socketId,
                        toNodeId: nodeId,
                        toSocketId: socketId,
                    },
                ];
            }
        }

        connectingFrom = null;
    }

    function deleteConnection(e: MouseEvent, connId: string) {
        e.preventDefault();
        e.stopPropagation();
        connections = connections.filter((c) => c.id !== connId);
    }

    // --- Geometry Helpers (DOM Based + Cached) ---
    // Problem: Calculating socket position manually is error prone if UI changes (Textarea resize).
    // Solution: Get DOM position.
    // Optimization: Reactive DOM reads can be expensive, but typical "drag node" only moves the PARENT.
    // Relative socket position inside the node is CONSTANT (mostly).

    // So: Socket Absolute Pos = Node Pos (reactive) + Socket Relative Offset (cached or measured).
    // Let's measure offset on hover or interact, or just use getBoundingClientRect because 10-20ms lag is acceptable vs "wrong position".
    // Actually, modern browsers handle getBoundingClientRect quite fast. Let's try to stick to DOM but ONLY for lines.

    function getSocketDomPos(
        nodeId: string,
        socketId: string,
    ): { x: number; y: number } | null {
        const domId = `socket_${nodeId}_${socketId}`;
        const el = document.getElementById(domId);
        if (!el || !canvasRef) return null;

        const rect = el.getBoundingClientRect();
        const canvasRect = canvasRef.getBoundingClientRect();

        return {
            x:
                (rect.left + rect.width / 2 - canvasRect.left) / scale -
                canvasX / scale,
            y:
                (rect.top + rect.height / 2 - canvasRect.top) / scale -
                canvasY / scale,
        };
    }

    // Svelte Action to update lines when nodes move
    // We pass 'nodes' dependency to getPathData in HTML to force re-render.

    function getPathData(conn: Connection, _nodes: any[]) {
        const fromPos = getSocketDomPos(conn.fromNodeId, conn.fromSocketId);
        const toPos = getSocketDomPos(conn.toNodeId, conn.toSocketId);

        // If DOM isn't ready, fallback
        if (!fromPos || !toPos) return "M 0 0 L 0 0";

        const curvature = 0.5;
        const dx = Math.abs(toPos.x - fromPos.x);
        const handleLen = Math.max(50, dx * curvature);

        return `M ${fromPos.x} ${fromPos.y} C ${fromPos.x + handleLen} ${fromPos.y} ${toPos.x - handleLen} ${toPos.y} ${toPos.x} ${toPos.y}`;
    }

    // --- Simulation Logic ---
    // Reactive simulation: runs whenever nodes or connections change
    $: simulationResult = runSimulation(nodes, connections);

    function runSimulation(
        currentNodes: NodeData[],
        currentConnections: Connection[],
    ) {
        const finalNode = currentNodes.find(
            (n) => n.label === "Final Output" || n.type === "text",
        );
        if (!finalNode) {
            return "Error: No text node found.";
        }

        const target =
            currentNodes.find((n) => n.label === "Final Output") || finalNode;
        const visited = new Set<string>();
        return evaluateNode(
            target.id,
            visited,
            currentNodes,
            currentConnections,
        );
    }

    function evaluateNode(
        nodeId: string,
        visited: Set<string>,
        currentNodes: NodeData[],
        currentConnections: Connection[],
    ): string {
        if (visited.has(nodeId)) return "[Cycle Detected]";
        visited.add(nodeId);

        const node = currentNodes.find((n) => n.id === nodeId);
        if (!node) return "";

        const inputValues: Record<string, string> = {};

        node.inputs.forEach((input) => {
            const conn = currentConnections.find(
                (c) => c.toNodeId === nodeId && c.toSocketId === input.id,
            );
            if (conn) {
                inputValues[input.id] = evaluateNode(
                    conn.fromNodeId,
                    new Set(visited),
                    currentNodes,
                    currentConnections,
                );
            } else {
                inputValues[input.id] = "";
            }
        });

        if (node.type === "text") {
            const prefix = Object.values(inputValues).join("");
            return prefix + node.content; // Concatenate
        } else if (node.type === "parameter") {
            return node.content;
        } else if (node.type === "function") {
            const valA = inputValues[`in_a`] || "";
            const valB = inputValues[`in_b`] || "";
            return `${valA} ${valB}`.trim();
        } else if (node.type === "conditional") {
            return "[One of paths]";
        }

        return "";
    }

    // Parser for highlighting {{placeholders}}
    function parseOutput(text: string) {
        if (!text) return [];
        // Split by {{...}} capturing the delimiters
        const parts = text.split(/(\{\{.*?\}\})/g);
        return parts.map((part) => {
            const isPlaceholder = part.startsWith("{{") && part.endsWith("}}");
            return {
                text: part,
                type: isPlaceholder ? "placeholder" : "text",
            };
        });
    }

    // Generate a consistent color from string
    function getColorForText(str: string) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        // HSL: Hash -> Hue (0-360), Saturation 70-80%, Lightness 60-70% for readability on dark
        const h = Math.abs(hash % 360);
        return `hsl(${h}, 75%, 65%)`;
    }

    // --- Sidebar ---
    const sidebarItems = [
        { type: "text", label: "Text Block", icon: "mdi:text" },
        { type: "parameter", label: "Parameter", icon: "mdi:code-braces" },
        { type: "conditional", label: "Condition", icon: "mdi:call-split" },
        { type: "function", label: "Combine", icon: "mdi:function" },
    ];

    function handleSidebarDragStart(e: DragEvent, type: string) {
        e.dataTransfer?.setData("nodeType", type);
    }

    function handleCanvasDrop(e: DragEvent) {
        e.preventDefault();
        const type = e.dataTransfer?.getData("nodeType") as NodeType;
        if (type && canvasRef) {
            const rect = canvasRef.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale - canvasX / scale;
            const y = (e.clientY - rect.top) / scale - canvasY / scale;
            addNode(type, x, y);
        }
    }
</script>

<svelte:window
    on:mousemove={handleGlobalMouseMove}
    on:mouseup={handleGlobalMouseUp}
/>

<div class="page-container">
    <!-- Left Sidebar -->
    <div class="sidebar">
        <h2 class="sidebar-title">Tools</h2>
        <div class="node-list">
            {#each sidebarItems as item}
                <div
                    class="sidebar-item"
                    draggable="true"
                    on:dragstart={(e) => handleSidebarDragStart(e, item.type)}
                >
                    <Icon icon={item.icon} width="20" />
                    <span>{item.label}</span>
                </div>
            {/each}
        </div>
        <div class="divider"></div>
        <div class="properties-panel">
            <h3>Usage</h3>
            <p class="hint">1. Drag nodes to canvas.</p>
            <p class="hint">2. Drag from Output to Input.</p>
        </div>
    </div>

    <!-- Main Canvas -->
    <div
        class="canvas-wrapper"
        bind:this={canvasRef}
        on:mousedown={handleMouseDownCanvas}
        on:drop={handleCanvasDrop}
        on:dragover={(e) => e.preventDefault()}
        role="application"
    >
        <div
            class="canvas-content"
            style="transform: translate({canvasX}px, {canvasY}px) scale({scale});"
        >
            <!-- Connections Layer -->
            <svg class="connections-layer">
                {#each connections as conn (conn.id)}
                    <!-- Invisible wide path for easier clicking -->
                    <path
                        class="connection-hitbox"
                        d={getPathData(conn, nodes)}
                        on:contextmenu={(e) => deleteConnection(e, conn.id)}
                        role="button"
                        tabindex="-1"
                    />
                    <!-- Visible path -->
                    <path
                        class="connection-line"
                        d={getPathData(conn, nodes)}
                    />
                {/each}

                {#if connectingFrom}
                    <path
                        class="connection-line active"
                        d={`M ${connectingFrom.x} ${connectingFrom.y} C ${connectingFrom.x + 50} ${connectingFrom.y} ${mousePos.x - 50} ${mousePos.y} ${mousePos.x} ${mousePos.y}`}
                    />
                {/if}
            </svg>

            <!-- Nodes Layer -->
            {#each nodes as node (node.id)}
                <div
                    class="node {node.type}"
                    style="left: {node.x}px; top: {node.y}px; width: {node.width}px; height: {node.height}px;"
                    role="group"
                >
                    <!-- Header is now the ONLY handle -->
                    <div
                        class="node-header"
                        on:mousedown={(e) => handleMouseDownHeader(e, node.id)}
                        role="button"
                        tabindex="0"
                    >
                        {#if editingNodeId === node.id}
                            <input
                                class="header-input"
                                type="text"
                                bind:value={node.label}
                                on:keydown={handleLabelInputKeydown}
                                on:blur={stopEditingLabel}
                                on:mousedown={(e) => e.stopPropagation()}
                                use:focus
                            />
                        {:else}
                            <span class="node-title">{node.label}</span>
                            <button
                                class="edit-btn"
                                on:mousedown={(e) =>
                                    startEditingLabel(e, node.id)}
                            >
                                <Icon icon="mdi:pencil" width="14" />
                            </button>
                        {/if}
                    </div>

                    <div class="node-body">
                        {#if node.type === "text"}
                            <textarea bind:value={node.content} rows="2"
                            ></textarea>
                        {:else if node.type === "parameter"}
                            <input type="text" bind:value={node.content} />
                        {/if}

                        <!-- Inputs and Outputs Container -->
                        <div class="node-io-row">
                            <!-- Inputs (Left Side) -->
                            <div class="sockets mod-left">
                                {#each node.inputs as input}
                                    <div
                                        class="socket input"
                                        id={`socket_${node.id}_${input.id}`}
                                        on:mouseup={(e) =>
                                            endConnection(e, node.id, input.id)}
                                        role="button"
                                        tabindex="0"
                                    >
                                        <div class="dot in-dot"></div>
                                        <span>{input.label}</span>
                                    </div>
                                {/each}
                            </div>

                            <!-- Outputs (Right Side) -->
                            <div class="sockets mod-right">
                                {#each node.outputs as output}
                                    <div
                                        class="socket output"
                                        id={`socket_${node.id}_${output.id}`}
                                        on:mousedown={(e) =>
                                            startConnection(
                                                e,
                                                node.id,
                                                output.id,
                                            )}
                                        role="button"
                                        tabindex="-1"
                                    >
                                        <span>{output.label}</span>
                                        <div class="dot out-dot"></div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </div>

                    <!-- Resize Handle -->
                    <div
                        class="resize-handle"
                        on:mousedown={(e) => handleMouseDownResize(e, node.id)}
                        role="button"
                        tabindex="-1"
                    >
                        <Icon
                            icon="mdi:resize-bottom-right"
                            width="16"
                            color="#666"
                        />
                    </div>
                </div>
            {/each}
        </div>

        <!-- Zoom Controls -->
        <div class="canvas-controls">
            <button on:click={() => (scale = Math.min(2, scale + 0.1))}
                >+</button
            >
            <span class="scale-text">{Math.round(scale * 100)}%</span>
            <button on:click={() => (scale = Math.max(0.2, scale - 0.1))}
                >-</button
            >
        </div>
    </div>

    <!-- Output/Simulation Panel -->
    <div class="output-panel">
        <div class="output-header">
            <h2>Live Preview</h2>
        </div>
        <div class="output-content">
            {#if simulationResult}
                <div class="result-box">
                    {#each parseOutput(simulationResult) as chunk}
                        {#if chunk.type === "placeholder"}
                            <span
                                class="placeholder"
                                style="color: {getColorForText(
                                    chunk.text,
                                )}; background: {getColorForText(
                                    chunk.text,
                                ).replace(')', ', 0.15)')};"
                            >
                                {chunk.text}
                            </span>
                        {:else}
                            <span>{chunk.text}</span>
                        {/if}
                    {/each}
                </div>
            {:else}
                <div class="placeholder-output">...</div>
            {/if}
        </div>
    </div>
</div>

<style>
    :global(body) {
        overflow: hidden;
    }

    .page-container {
        display: flex;
        width: 100vw;
        height: 100vh;
        background-color: #1a1a1a;
        color: #e0e0e0;
        font-family: "Inter", sans-serif;
        overflow: hidden;
        user-select: none; /* Prevent text selection globablly */
    }

    /* Sidebar */
    .sidebar {
        width: 250px;
        background-color: #252525;
        border-right: 1px solid #333;
        display: flex;
        flex-direction: column;
        padding: 1rem;
        z-index: 10;
        box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
    }

    .sidebar-title {
        font-size: 1.2rem;
        font-weight: 600;
        margin-bottom: 1.5rem;
        color: #fff;
    }

    .sidebar-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: #333;
        border: 1px solid #444;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: grab;
        transition: all 0.2s;
        user-select: none;
    }

    .sidebar-item:hover {
        background: #404040;
        border-color: #555;
        transform: translateX(2px);
    }

    .sidebar-item:active {
        cursor: grabbing;
    }

    .divider {
        height: 1px;
        background: #333;
        margin: 20px 0;
    }

    .hint {
        font-size: 0.85rem;
        color: #888;
        margin-bottom: 4px;
    }

    /* Canvas */
    .canvas-wrapper {
        flex: 1;
        position: relative;
        background-color: #121212;
        background-image: radial-gradient(#333 1px, transparent 1px);
        background-size: 20px 20px;
        overflow: hidden;
        cursor: default;
    }

    .canvas-content {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        transform-origin: 0 0;
        pointer-events: none;
    }

    .connections-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 10000px; /* Large enough to cover zoomed out area */
        height: 10000px;
        pointer-events: none;
        z-index: 0;
        overflow: visible;
    }

    .connection-line {
        fill: none;
        stroke: #666;
        stroke-width: 2px;
        pointer-events: none;
    }

    .connection-hitbox {
        fill: none;
        stroke: transparent;
        stroke-width: 15px; /* Wide hitbox */
        pointer-events: stroke;
        cursor: pointer;
    }

    .connection-hitbox:hover + .connection-line {
        stroke: #ff4d4d; /* Red on hover */
        stroke-width: 3px;
    }

    .connection-line.active {
        stroke: #fff;
        stroke-dasharray: 5, 5;
    }

    /* Node */
    .node {
        position: absolute;
        width: 220px;
        background: #2a2a2a;
        border: 1px solid #444;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        pointer-events: auto;
    }

    .node.text {
        border-top: 3px solid #4facfe;
    }
    .node.parameter {
        border-top: 3px solid #00f260;
    }
    .node.function {
        border-top: 3px solid #f093fb;
    }
    .node.conditional {
        border-top: 3px solid #ff9a9e;
    }

    .node-header {
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.05);
        border-bottom: 1px solid #333;
        font-weight: 500;
        font-size: 0.9rem;
        cursor: grab; /* Drag handle */
        flex-shrink: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 40px; /* Fixed height for stability */
    }

    .header-input {
        background: #222;
        border: 1px solid #4facfe;
        color: #fff;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.9rem;
        width: 100%;
        outline: none;
    }

    .edit-btn {
        background: transparent;
        border: none;
        color: #666;
        cursor: pointer;
        padding: 2px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0; /* Hidden by default */
        transition: all 0.2s;
    }

    .node-header:hover .edit-btn {
        opacity: 1; /* Show on hover */
    }

    .edit-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
    }

    .node-header:active {
        cursor: grabbing;
        background: rgba(255, 255, 255, 0.1);
    }

    .node-body {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1; /* Occupy remaining height */
        min-height: 0; /* Enable scrolling/shrinking */
    }

    .node-body textarea,
    .node-body input {
        width: 100%;
        background: #111;
        border: 1px solid #333;
        color: #eee;
        padding: 6px;
        border-radius: 4px;
        font-size: 0.85rem;
        resize: none;
        z-index: 10;
        position: relative;
        user-select: text; /* Allow selection inside inputs */
        cursor: text;
    }

    .node-body textarea {
        flex: 1; /* Grow to fill space */
    }

    /* Resize Handle */
    .resize-handle {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        cursor: nwse-resize;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.5;
        transition: opacity 0.2s;
        border-radius: 0 0 8px 0;
        z-index: 20; /* Ensure on top of inputs */
    }

    .resize-handle:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.05);
    }

    .node-io-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        position: relative;
    }

    .sockets {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 40px;
    }

    .sockets.mod-right {
        align-items: flex-end;
    }

    .socket {
        display: flex;
        align-items: center;
        font-size: 0.75rem;
        color: #aaa;
        height: 20px;
        cursor: crosshair;
        pointer-events: auto;
    }

    .socket:hover {
        color: #fff;
    }

    .socket.input {
        justify-content: flex-start;
    }
    .socket.output {
        justify-content: flex-end;
    }

    .socket .dot {
        width: 10px;
        height: 10px;
        background: #555;
        border-radius: 50%;
        border: 1px solid #222;
        transition:
            transform 0.2s,
            background 0.2s;
    }

    .in-dot {
        margin-right: 6px;
    }
    .out-dot {
        margin-left: 6px;
    }

    .socket:hover .dot {
        background: #fff;
        transform: scale(1.3);
        border-color: #00f260;
    }

    /* Output Panel */
    .output-panel {
        width: 300px;
        background-color: #1e1e1e;
        border-left: 1px solid #333;
        display: flex;
        flex-direction: column;
        z-index: 10;
    }

    .output-header {
        padding: 1rem;
        border-bottom: 1px solid #333;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .output-header h2 {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0;
    }

    .output-content {
        padding: 1rem;
        flex: 1;
        background: #151515;
        overflow-y: auto;
    }

    .placeholder-output {
        color: #555;
        font-style: italic;
        text-align: center;
        margin-top: 2rem;
    }

    .result-box {
        background: #222;
        border: 1px solid #333;
        padding: 15px;
        border-radius: 4px;
        white-space: pre-wrap;
        line-height: 1.6;
        font-family: monospace;
        color: #ccc;
    }

    /* Syntax Highlighting */
    .result-box .placeholder {
        font-weight: bold;
        padding: 2px 4px;
        border-radius: 4px;
        /* Color handling is done via inline styles now */
    }

    .canvas-controls {
        position: absolute;
        bottom: 20px;
        left: 20px;
        background: #252525;
        padding: 5px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid #444;
        z-index: 50;
    }

    .canvas-controls button {
        background: #333;
        border: none;
        color: #fff;
        width: 25px;
        height: 25px;
        border-radius: 4px;
        cursor: pointer;
    }

    .canvas-controls button:hover {
        background: #444;
    }

    .scale-text {
        font-size: 0.8rem;
        color: #aaa;
        min-width: 40px;
        text-align: center;
    }
</style>

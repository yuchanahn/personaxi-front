<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount, tick } from "svelte";
    import type { ImageMetadata, Persona, PersonaFeedback } from "$lib/types";
    import { page } from "$app/stores";
    import {
        fetchAndSetAssetTypes,
        getUploadUrl,
        loadPersonaOriginal,
        savePersona,
        uploadFileWithProgress,
        uploadLive2DZip,
    } from "$lib/api/edit_persona";
    import LoadingAnimation from "$lib/components/utils/LoadingAnimation.svelte";
    import { number, t } from "svelte-i18n";
    import FirstCreationRewardModal from "$lib/components/modal/FirstCreationRewardModal.svelte";
    import { st_user } from "$lib/stores/user";
    import { get } from "svelte/store";
    import { api } from "$lib/api";
    import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
    import { VRMLoaderPlugin } from "@pixiv/three-vrm";
    import AssetPreview from "$lib/components/AssetPreview.svelte";
    import { allCategories } from "$lib/constants";
    import Icon from "@iconify/svelte";
    import FirstSceneBuilder from "$lib/components/FirstSceneBuilder.svelte";
    import { toast } from "$lib/stores/toast";
    import { confirmStore } from "$lib/stores/confirm";
    import { extractFirstFrame } from "$lib/utils/media";
    import { chatSessions } from "$lib/stores/chatSessions";
    import { FFmpegManager } from "$lib/utils/ffmpeg";

    let originalPersona: Persona | null = null;
    let vrmFile: File | null = null;
    let live2dFile: File | null = null;
    let live2d_progress = 0;

    let persona: Persona = {
        id: "",
        owner_id: [],
        name: "",
        one_liner: "", // Add this
        personaType: "",
        contentType: "character", // Add this
        instructions: [],
        promptExamples: [],
        tags: [],

        feedback: {
            view: 0,
        },
        voice_id: "",
        vrm_url: "", // Add this
        portrait_url: "", // Add this
        image_metadatas: [], // Add this
        image_count: 0,
        visibility: "private", // Add this, default to private
        created_at: "",
        updated_at: "",
        creator_name: "",
        first_scene: "",
        greeting: "",
        likes_count: 0,
        dislikes_count: 0,
        chat_count: 0,
    };

    let instruction = "";
    let singleInstruction = "";
    let selectedTemplate = "custom";
    let promptExample = "";
    let error = "";
    let last_id: string | null = null;
    let availableExpressions: string[] = [];
    let availableMotions: string[] = [];

    // --- [Kintsugi 템플릿 변수] ---
    const kintsugiTemplateId = "kintsugi_v1";
    let k_description = "";
    let k_personality = "";
    let k_userPersona = "";
    let k_scenario = "";
    // ---------------------------------

    // --- [JSON Builder 변수] ---
    let instructionJson = "";
    let firstSceneJson = "";
    // ---------------------------

    let allVoices: any[] = []; // ElevenLabs에서 받아온 전체 목소리 목록
    let selectedVoiceId = ""; // 사용자가 선택한 voice_id

    $: selectedVoice = allVoices.find((v) => v.voice_id === selectedVoiceId);
    $: if (selectedVoiceId) {
        persona.voice_id = selectedVoiceId;
    } else {
        persona.voice_id = "";
    }

    $: if (persona.contentType === "story") {
        persona.personaType = "2D";
    }

    let firstSceneTextarea: HTMLTextAreaElement;

    let toggleDialogueTag = false;

    function insertDialogueTag() {
        if (!firstSceneTextarea) return;

        const target = toggleDialogueTag ? "{{user}}" : "{{char}}";
        const snippet = `<dialogue speaker="${target}"></dialogue>`;

        const pos = firstSceneTextarea.selectionStart;
        const currentVal = persona.first_scene;

        persona.first_scene =
            currentVal.substring(0, pos) + snippet + currentVal.substring(pos);

        const newPos = pos + `<dialogue speaker="${target}">`.length;

        tick().then(() => {
            firstSceneTextarea.focus();
            firstSceneTextarea.selectionStart = newPos;
            firstSceneTextarea.selectionEnd = newPos;
        });
    }

    async function loadLive2DMetadata(url: string) {
        if (!url) return;
        try {
            // console.log("Fetching Live2D metadata from:", url);
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch model3.json");
            const data = await response.json();

            // Parse Expressions (Support Cubism 3+ and older/other formats)
            let rawExprs: any[] = [];
            if (data.FileReferences?.Expressions) {
                rawExprs = data.FileReferences.Expressions;
            } else if (data.expressions) {
                rawExprs = data.expressions;
            }

            if (Array.isArray(rawExprs)) {
                availableExpressions = rawExprs
                    .map((e: any) => {
                        if (typeof e === "string") return e;
                        const name = e.Name || e.name || e.Id || e.id;
                        const file = e.File || e.file;
                        return (
                            name ||
                            (file
                                ? file
                                      .split("/")
                                      .pop()
                                      .replace(".exp3.json", "")
                                : "")
                        );
                    })
                    .filter((n: string) => n);
            }

            // Parse Motions
            let rawMotions: any = {};
            if (data.FileReferences?.Motions) {
                rawMotions = data.FileReferences.Motions;
            } else if (data.motions) {
                rawMotions = data.motions;
            }

            const files: string[] = [];
            // Handle both object (grouped) and array (flat) structures if applicable
            // Standard is usually Group -> Array of Motion Definitions
            Object.values(rawMotions).forEach((group: any) => {
                if (Array.isArray(group)) {
                    group.forEach((m: any) => {
                        const f = m.File || m.file;
                        if (f) files.push(f);
                    });
                }
            });
            availableMotions = files;

            // console.log("Loaded Live2D Metadata:", {
            //     availableExpressions,
            //     availableMotions,
            // });
        } catch (e) {
            console.warn("Failed to load Live2D metadata for UI:", e);
        }
    }

    async function load_persona(id: string) {
        try {
            const p = await loadPersonaOriginal(id);
            originalPersona = JSON.parse(JSON.stringify(p));

            if (p.instructions.length > 1 && p.instructions[1]) {
                const templateIdentifier = p.instructions[1];
                if (templateIdentifier === "conversation") {
                    selectedTemplate = "conversation";
                    singleInstruction = p.instructions[0] || "";
                } else if (templateIdentifier === "simulation") {
                    selectedTemplate = "simulation";
                    singleInstruction = p.instructions[0] || "";
                } else if (templateIdentifier === kintsugiTemplateId) {
                    // Kintsugi 템플릿 감지
                    selectedTemplate = kintsugiTemplateId;
                    try {
                        // 저장된 JSON 문자열을 파싱하여 각 필드에 채움
                        const data = JSON.parse(p.instructions[0] || "{}");
                        k_description = data.description || "";
                        k_personality = data.personality || "";
                        k_userPersona = data.userPersona || "";
                        k_scenario = data.scenario || "";
                    } catch (e) {
                        console.error("Kintsugi JSON 파싱 실패", e);
                        k_description = p.instructions[0] || "";
                    }
                } else {
                    selectedTemplate = "custom";
                    singleInstruction = p.instructions[0] || "";
                }
            } else {
                selectedTemplate = "custom";
                singleInstruction = p.instructions[0] || "";
            }
            // -----------------------------------------

            if (p.voice_id) {
                selectedVoiceId = p.voice_id;
            } else {
                selectedVoiceId = "";
            }
            portraitPreview = p.portrait_url;

            // Initialize firstSceneJson for 3D personas
            if (p.personaType === "3D" && p.first_scene) {
                firstSceneJson = p.first_scene;
            }

            if (p.image_metadatas && p.image_metadatas.length > 0) {
                const metadatasWithType = await fetchAndSetAssetTypes(
                    p.image_metadatas,
                );
                p.image_metadatas = metadatasWithType;
            } else {
                p.image_metadatas = [];
            }
            persona = p;
            if (!persona.one_liner) persona.one_liner = "";
            firstSceneJson = p.first_scene;

            // Load Metadata if Live2D
            if (
                persona.live2d_model_url &&
                (persona.personaType === "2.5D" || persona.personaType === "2D")
            ) {
                loadLive2DMetadata(persona.live2d_model_url);
            }

            // // console.log("Loaded persona:", persona);
            return p;
        } catch (err) {
            console.error("페르소나를 불러오는 데 실패했습니다:", err);
        }
    }

    $: {
        const id = $page.url.searchParams.get("c");
        if (id !== last_id) {
            last_id = id;
            if (id) load_persona(id);
        }
    }

    async function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            vrmFile = input.files[0];

            const isValid = await validateVRMLicense(vrmFile);
            if (!isValid) {
                toast.error($t("editPage.vrmLicenseError"));
                input.value = ""; // Clear input
                vrmFile = null;
                return;
            }

            uploadVrmFile();
        }
    }

    let portraitFile: File | null = null;
    let portraitImageFile: File | null = null;
    let portraitPreview: string | null = null;
    let compression_progress = 0;
    let isCompressing = false;

    async function handleProfileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const originalFile = input.files[0];
            portraitFile = originalFile;

            // Check if video
            if (originalFile.type.startsWith("video/")) {
                const frame = await extractFirstFrame(originalFile);
                if (frame) {
                    portraitImageFile = frame;
                    portraitPreview = URL.createObjectURL(frame);
                } else {
                    portraitPreview = URL.createObjectURL(originalFile);
                }

                // Compress Video
                try {
                    isCompressing = true;
                    compression_progress = 0;
                    toast.info("Compressing video... Please wait.");

                    const compressed =
                        await FFmpegManager.getInstance().compressVideo(
                            originalFile,
                            (p) => {
                                compression_progress = p;
                            },
                        );

                    portraitFile = compressed; // Use compressed file for upload
                    toast.success("Compression complete!");
                } catch (e) {
                    console.error("Compression failed, using original:", e);
                    toast.error("Compression failed. Uploading original.");
                } finally {
                    isCompressing = false;
                    compression_progress = 0;
                }
            } else {
                portraitImageFile = null; // Reset if not video
                portraitPreview = URL.createObjectURL(originalFile);
            }

            uploadPortraitFile();
        }
    }

    onMount(async () => {
        if (!(await api.isLoggedIn())) {
            goto("/login");
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get("c");
        if (id) {
            load_persona(id);
        }

        try {
            const response = await fetch("/voices.json"); // static/voices.json
            if (response.ok) {
                const data = await response.json();
                allVoices = data.voices;
            }
        } catch (e) {
            console.error("Failed to load voices.json", e);
        }
    });

    let vrmInput: HTMLInputElement;

    async function validateVRMLicense(file: File): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const loader = new GLTFLoader();
            loader.register((parser) => {
                return new VRMLoaderPlugin(parser);
            });

            loader.load(
                url,
                (gltf) => {
                    URL.revokeObjectURL(url);
                    const vrm = gltf.userData.vrm;
                    const meta = vrm?.meta || gltf.userData.vrmMeta; // Support both VRM 0.0 and 1.0 (via plugin)

                    if (!meta) {
                        console.warn("No VRM meta found");
                        resolve(false);
                        return;
                    }

                    // console.log("VRM Meta:", meta);
                    // console.log("Checking license fields...");
                    // console.log("otherPermissionUrl:", meta.otherPermissionUrl);
                    // console.log("licenseName:", meta.licenseName);
                    // console.log("reference:", meta.reference);

                    // Check for 'personaxi' in license fields
                    const otherLicenseUrl = (
                        meta.otherLicenseUrl ||
                        meta.licenseUrl ||
                        ""
                    )
                        .toString()
                        .toLowerCase();
                    const authors = meta.authors || [];
                    const authorMatch =
                        Array.isArray(authors) &&
                        authors.some((a) => {
                            if (typeof a === "string") {
                                return a.toLowerCase().includes("personaxi");
                            } else if (a && typeof a === "object") {
                                // Check common fields like name or authorName
                                const nameField = a.name || a.authorName || "";
                                return (
                                    typeof nameField === "string" &&
                                    nameField
                                        .toLowerCase()
                                        .includes("personaxi")
                                );
                            }
                            return false;
                        });
                    if (otherLicenseUrl.includes("personaxi") || authorMatch) {
                        // console.log("License validation PASSED");
                        resolve(true);
                    } else {
                        // console.log("License validation FAILED");
                        resolve(false);
                    }
                },
                (progress) => {
                    // console.log(
                    //     "Loading VRM for validation...",
                    //     (progress.loaded / progress.total) * 100 + "%",
                    // );
                },
                (error) => {
                    URL.revokeObjectURL(url);
                    console.error("Failed to load VRM for validation:", error);
                    resolve(false); // Fail safe
                },
            );
        });
    }

    async function handleVRMUploadClick() {
        if (await confirmStore.ask($t("editPage.vrmLicenseWarning"))) {
            vrmInput.click();
        }
    }

    async function handleLive2DUploadClick() {
        if (await confirmStore.ask($t("editPage.licenseUploadWarning"))) {
            document.getElementById("live2d-file")?.click();
        }
    }

    function toggleTag(tagId: string) {
        if (persona.tags.includes(tagId)) {
            persona.tags = persona.tags.filter((id) => id !== tagId);
        } else {
            if (persona.tags.length < 3) {
                persona.tags = [...persona.tags, tagId];
            } else {
                toast.warning($t("editPage.validation.maxTags"));
            }
        }
    }

    let loading = false;
    let showSuccess = false;
    let uploadProgress = 0;

    let showRewardModal = false;
    let previousPersonaType = persona.personaType;
    let hasReceivedFirstCreationReward =
        get(st_user)?.data.hasReceivedFirstCreationReward ?? false;

    let copiedState = new Map<number, boolean>();

    async function copyAssetTag(index: number) {
        const tag = `<img ${index}>`;
        try {
            await navigator.clipboard.writeText(tag);
            copiedState.set(index, true);
            copiedState = copiedState;

            setTimeout(() => {
                copiedState.set(index, false);
                copiedState = copiedState;
            }, 2000);
        } catch (err) {
            console.error("클립보드 복사 실패:", err);
        }
    }

    function removeAssetByIndex(indexToRemove: number) {
        persona.image_metadatas = persona.image_metadatas.filter(
            (_, index) => index !== indexToRemove,
        );
    }

    async function handleAssetFileChange(event: Event, assetId: number) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];
            await uploadAssetFile(assetId, file);
        }
    }

    let assets_progress: Map<number, number> = new Map();
    let vrm_progress: number = 0;
    let portrait_progress: number = 0;

    async function handleMultipleAssetFiles(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            // Limit check
            if (persona.image_metadatas.length + input.files.length > 40) {
                toast.warning("Maximum 40 images allowed.");
                return;
            }

            Array.from(input.files).forEach(async (file) => {
                const asset: ImageMetadata = {
                    url: "",
                    description: file.name,
                };
                if (persona.image_metadatas == null) {
                    persona.image_metadatas = [];
                }

                persona.image_metadatas.push(asset);
                await uploadAssetFile(persona.image_metadatas.length - 1, file);
            });
        }
    }

    const supabaseURL = "/storage/v1/object/public/personaxi-assets/";

    async function handleLive2DUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        live2dFile = file;
        live2d_progress = 0;
        error = "";

        try {
            // Only delete if it's NOT the original file (i.e. it's a temp file)
            const oldUrl =
                persona.live2d_model_url !== originalPersona?.live2d_model_url
                    ? persona.live2d_model_url
                    : undefined;

            const result = await uploadLive2DZip(
                file,
                (percent) => {
                    live2d_progress = Math.round(percent);
                },
                oldUrl,
            );

            persona.live2d_model_url = result.model3_json_url;
            availableExpressions = result.expressions;
            availableMotions = result.motions;
            // console.log("Live2D Upload Success:", result);
        } catch (e: any) {
            console.error("Live2D Upload Error:", e);
            error = `Live2D upload failed: ${e.message}`;
            live2dFile = null;
        }
    }

    async function uploadAssetFile(assetId: number, file: File) {
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const currentUrl = persona.image_metadatas[assetId]?.url;

                // Only delete if different from original
                const originalUrl =
                    originalPersona?.image_metadatas?.[assetId]?.url;
                const isTemp = currentUrl !== originalUrl;

                const oldUrl =
                    currentUrl && !currentUrl.startsWith("blob:") && isTemp
                        ? currentUrl
                        : undefined;
                const response = await getUploadUrl("asset", oldUrl);
                if (!response.ok) {
                    throw new Error(
                        `Server error on getting URL: ${response.status}`,
                    );
                }
                const { signedURL, fileName } = await response.json();

                if (attempt === 1) {
                    persona.image_metadatas[assetId].url =
                        URL.createObjectURL(file);
                    persona.image_metadatas = [...persona.image_metadatas];
                }

                await uploadFileWithProgress(signedURL, file, (percent) => {
                    assets_progress.set(assetId, percent);
                    assets_progress = assets_progress;
                });

                assets_progress.delete(assetId);
                assets_progress = assets_progress;
                persona.image_metadatas[assetId].url =
                    `${supabaseURL}${fileName}`;
                persona.image_metadatas[assetId].type = undefined;

                // console.log(
                //     `✅ ${file.name} uploaded successfully on attempt ${attempt}`,
                // );

                return;
            } catch (e: any) {
                console.warn(
                    `Attempt ${attempt} for ${file.name} failed: ${e.message}`,
                );

                if (attempt === MAX_RETRIES) {
                    error = `File upload failed for ${file.name} after ${MAX_RETRIES} attempts.`;
                    console.error("Giving up on upload for", file.name);
                } else {
                    await new Promise((res) => setTimeout(res, 500));
                }
            }
        }
    }

    async function uploadVrmFile() {
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Only delete if different from original
                const isTemp = persona.vrm_url !== originalPersona?.vrm_url;
                const oldUrl =
                    persona.vrm_url &&
                    !persona.vrm_url.startsWith("blob:") &&
                    isTemp
                        ? persona.vrm_url
                        : undefined;
                const response = await getUploadUrl("vrm", oldUrl);
                if (!response.ok) {
                    throw new Error(
                        `Server error on getting URL: ${response.status}`,
                    );
                }
                const { signedURL, fileName } = await response.json();

                vrm_progress = 0.01;

                await uploadFileWithProgress(signedURL, vrmFile!, (percent) => {
                    vrm_progress = Math.round(percent);
                });
                persona.vrm_url = `${supabaseURL}${fileName}`;
                vrm_progress = 0;

                // console.log(
                //     `✅ ${vrmFile!.name} uploaded successfully on attempt ${attempt}`,
                // );

                return;
            } catch (e: any) {
                console.warn(
                    `Attempt ${attempt} for ${vrmFile!.name} failed: ${e.message}`,
                );

                if (attempt === MAX_RETRIES) {
                    error = `File upload failed for ${vrmFile!.name} after ${MAX_RETRIES} attempts.`;
                    console.error("Giving up on upload for", vrmFile!.name);
                } else {
                    await new Promise((res) => setTimeout(res, 500));
                }
            }
        }
    }

    async function uploadPortraitFile() {
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Only delete if different from original
                const isTemp =
                    persona.portrait_url !== originalPersona?.portrait_url;
                const oldUrl =
                    persona.portrait_url &&
                    !persona.portrait_url.startsWith("blob:") &&
                    isTemp
                        ? persona.portrait_url
                        : undefined;
                const response = await getUploadUrl("portrait", oldUrl);
                if (!response.ok) {
                    throw new Error(
                        `Server error on getting URL: ${response.status}`,
                    );
                }
                const { signedURL, fileName } = await response.json();

                portrait_progress = 0.01;

                await uploadFileWithProgress(
                    signedURL,
                    portraitFile!,
                    (percent) => {
                        portrait_progress = Math.round(percent);
                    },
                );
                persona.portrait_url = `${supabaseURL}${fileName}`;
                portraitPreview = `${supabaseURL}${fileName}`;
                portrait_progress = 0;

                // Upload static portrait if exists (e.g. video thumbnail)
                if (portraitImageFile) {
                    await uploadStaticPortrait(portraitImageFile);
                } else {
                    persona.static_portrait_url = persona.portrait_url;
                }

                // console.log(
                //     `✅ ${portraitFile!.name} uploaded successfully on attempt ${attempt}`,
                // );

                return;
            } catch (e: any) {
                console.warn(
                    `Attempt ${attempt} for ${portraitFile!.name} failed: ${e.message}`,
                );

                if (attempt === MAX_RETRIES) {
                    error = `File upload failed for ${portraitFile!.name} after ${MAX_RETRIES} attempts.`;
                    console.error(
                        "Giving up on upload for",
                        portraitFile!.name,
                    );
                } else {
                    await new Promise((res) => setTimeout(res, 500));
                }
            }
        }
    }

    async function uploadStaticPortrait(file: File) {
        try {
            // Logic similar to uploadPortraitFile but for static_portrait
            // We can reuse getUploadUrl with a suffix or new type?
            // Since backend doesn't care about "type" strictly for URL generation usually, we can treat it as 'portrait'
            // but we need a unique name. unique name is handled by backend usually or we just upload.

            // Simplest: Upload as 'asset' or 'portrait' type but ensure we set persona.static_portrait_url

            const response = await getUploadUrl("asset", undefined); // Treat as generic asset to get a URL
            if (!response.ok) return;

            const { signedURL, fileName } = await response.json();

            await uploadFileWithProgress(signedURL, file, (p) => {});

            persona.static_portrait_url = `${supabaseURL}${fileName}`;
        } catch (e) {
            console.error("Failed to upload static portrait", e);
        }
    }

    function handleStartChat() {
        if (!persona.id) {
            toast.error("저장 후 대화할 수 있습니다.");
            return;
        }

        // Default to Flash-Lite
        let llmType = "gemini-flash-lite";

        // Check if user has a saved preference for this session
        chatSessions.update((sessions) => {
            const existingSession = sessions.find(
                (session) => session.id === persona?.id,
            );
            if (existingSession && existingSession.llmType) {
                llmType = existingSession.llmType;
            }
            return sessions;
        });

        // Force Flash-Lite for 3D/Live2D modes (override saved preference)
        if (persona?.personaType === "3D" || persona?.personaType === "2.5D") {
            llmType = "gemini-flash-lite";
        }

        if (persona?.personaType === "2D" || persona?.personaType === "2d") {
            goto(`/2d?c=${persona.id}&llmType=${llmType}`);
        } else if (persona?.personaType === "3D") {
            goto(`/character?c=${persona.id}&llmType=${llmType}`);
        } else if (persona?.personaType === "2.5D") {
            goto(`/live2d?c=${persona.id}&llmType=${llmType}`);
        } else {
            toast.error(`Unknown Persona Type: ${persona?.personaType}`);
        }
    }
</script>

<div class="container">
    <div class="header">
        <h1>{$t("editPage.title")}</h1>
        <div class="header-actions">
            {#if persona.id}
                <button
                    class="chat-button secondary"
                    on:click={handleStartChat}
                >
                    <Icon icon="ph:chat-circle-dots-bold" />
                    <span>{$t("profilePage.startChatButton")}</span>
                </button>
            {/if}
            <button
                class="save-button"
                type="submit"
                on:click={async () => {
                    if (loading || showSuccess) return;

                    error = "";

                    // --- [수정] Kintsugi 저장 로직 및 유효성 검사 ---
                    let finalInstructions = [];

                    if (selectedTemplate === kintsugiTemplateId) {
                        // [신규] Kintsugi 필드 개별 글자 수 검사
                        if (k_description.length > 1000) {
                            error = $t("editPage.validation.kintsugiDescLimit");
                            return;
                        }
                        if (k_personality.length > 1000) {
                            error = $t(
                                "editPage.validation.kintsugiPersonalityLimit",
                            );
                            return;
                        }
                        if (k_userPersona.length > 800) {
                            error = $t(
                                "editPage.validation.kintsugiUserPersonaLimit",
                            );
                            return;
                        }
                        if (k_scenario.length > 200) {
                            error = $t(
                                "editPage.validation.kintsugiScenarioLimit",
                            );
                            return;
                        }

                        const kintsugiJson = JSON.stringify({
                            description: k_description,
                            personality: k_personality,
                            userPersona: k_userPersona,
                            scenario: k_scenario,
                        });
                        finalInstructions.push(kintsugiJson);
                    } else {
                        finalInstructions.push(singleInstruction);

                        if (singleInstruction.length > 3000) {
                            error = $t(
                                "editPage.validation.instructionsLimitExceeded",
                            );
                            return;
                        }
                        if (!singleInstruction.trim()) {
                            error = $t("editPage.validation.allFieldsRequired");
                            return;
                        }
                    }

                    // 템플릿 식별자 추가
                    if (selectedTemplate === "conversation") {
                        finalInstructions.push("conversation");
                    } else if (selectedTemplate === "simulation") {
                        finalInstructions.push("simulation");
                    } else if (selectedTemplate === kintsugiTemplateId) {
                        finalInstructions.push(kintsugiTemplateId); // 신규 템플릿 ID
                    } else {
                        finalInstructions.push("custom");
                    }

                    persona.instructions = finalInstructions;
                    // ----------------------------------------------

                    if (
                        !persona.name.trim() ||
                        !persona.personaType.trim() ||
                        !persona.greeting.trim() ||
                        !persona.first_scene.trim() ||
                        persona.tags.length === 0
                    ) {
                        error = $t("editPage.validation.allFieldsRequired");
                        return;
                    }

                    if (
                        persona.greeting.length > 200 ||
                        persona.first_scene.length > 2500
                    ) {
                        error = $t("editPage.validation.charLimitExceeded");
                        return;
                    }

                    if (
                        persona.promptExamples.some((ex) => ex.length > 200) ||
                        persona.promptExamples.length > 10
                    ) {
                        error = $t(
                            "editPage.validation.promptExamplesLimitExceeded",
                        );
                        return;
                    }

                    loading = true;
                    uploadProgress = 0; // 저장 시작 시 진행률 초기화

                    try {
                        const id: string | null = await savePersona(persona);

                        if (id) {
                            showSuccess = true;

                            setTimeout(() => {
                                showSuccess = false;
                            }, 2000);

                            if (!persona.id) {
                                goto(`/edit?c=${id}`, { replaceState: true });
                                if (hasReceivedFirstCreationReward) {
                                    showRewardModal = true;
                                    hasReceivedFirstCreationReward = false;
                                }
                            } else {
                                load_persona(id);
                            }
                        }
                    } catch (e: any) {
                        error = $t("editPage.errorSaveFailed", {
                            values: { message: e.message },
                        });
                        if (typeof window !== "undefined") {
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                    } finally {
                        loading = false;
                    }
                }}
            >
                {#if loading}
                    <span
                        >{$t("editPage.saveButtonLoading")} ({Math.round(
                            uploadProgress,
                        )}%)</span
                    >
                {:else if showSuccess}
                    <span>{$t("editPage.saveButtonSuccess")}</span>
                {:else}
                    <span>{$t("editPage.saveButton")}</span>
                {/if}
            </button>
        </div>
    </div>
    {#if error}
        <p class="error">{error}</p>
    {/if}
    <div class="scrollable-content">
        <div class="form-grid">
            <div class="form-column">
                <!-- Content Type Selector -->
                <div class="content-type-selector">
                    <button
                        class:active={persona.contentType === "character" ||
                            !persona.contentType}
                        on:click={() => (persona.contentType = "character")}
                    >
                        <Icon icon="ph:user-circle-duotone" width="24" />
                        <div class="text">
                            <span class="title"
                                >{$t("editPage.type.character")}</span
                            >
                            <span class="desc"
                                >{$t("editPage.type.characterDesc")}</span
                            >
                        </div>
                    </button>
                    <button
                        class:active={persona.contentType === "story"}
                        on:click={() => (persona.contentType = "story")}
                    >
                        <Icon icon="ph:book-open-text-duotone" width="24" />
                        <div class="text">
                            <span class="title"
                                >{$t("editPage.type.story")}</span
                            >
                            <span class="desc"
                                >{$t("editPage.type.storyDesc")}</span
                            >
                        </div>
                    </button>
                </div>

                <div class="form-section-card">
                    <h2>{$t("editPage.basicInfo")}</h2>
                    <div class="form-group">
                        <label for="name">
                            {persona.contentType === "story"
                                ? $t("editPage.storyNameLabel")
                                : $t("editPage.nameLabel")}
                        </label>
                        <input
                            id="name"
                            bind:value={persona.name}
                            required
                            placeholder={persona.contentType === "story"
                                ? $t("editPage.storyNamePlaceholder")
                                : $t("editPage.namePlaceholder")}
                        />
                    </div>
                    <div class="form-group">
                        <label for="one_liner">
                            {persona.contentType === "story"
                                ? $t("editPage.storyOneLinerLabel")
                                : $t("editPage.oneLinerLabel")}
                        </label>
                        <p class="description">
                            {persona.contentType === "story"
                                ? $t("editPage.storyOneLinerDescription")
                                : $t("editPage.oneLinerDescription")}
                        </p>
                        <input
                            id="one_liner"
                            placeholder={persona.contentType === "story"
                                ? $t("editPage.oneLinerPlaceholder") // Reusing placeholder as it seems generic enough or can be updated later
                                : $t("editPage.oneLinerPlaceholder")}
                            bind:value={persona.one_liner}
                            maxlength="60"
                            class="input-field"
                        />
                        <div
                            class="char-counter {(persona.one_liner || '')
                                .length > 60
                                ? 'error'
                                : ''}"
                        >
                            {(persona.one_liner || "").length}/60
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="greeting"
                            >{$t("editPage.greetingLabel", {
                                default: $t("editPage.greetingLabelDefault"),
                            })}</label
                        >
                        <p class="description">
                            {$t("editPage.greetingDescription", {
                                default: $t(
                                    "editPage.greetingDescriptionDefault",
                                ),
                            })}
                        </p>
                        <textarea
                            id="greeting"
                            bind:value={persona.greeting}
                            placeholder={$t("editPage.greetingPlaceholder", {
                                default: $t(
                                    "editPage.greetingPlaceholderDefault",
                                ),
                            })}
                            rows="3"
                            maxlength="200"
                        ></textarea>
                        <div
                            class="char-counter"
                            class:warning={persona.greeting.length > 160}
                            class:error={persona.greeting.length >= 200}
                        >
                            {persona.greeting.length} / 200
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="personaType"
                            >{$t("editPage.typeLabel")}</label
                        >
                        <select
                            id="personaType"
                            bind:value={persona.personaType}
                            on:change={() => {
                                if (
                                    (previousPersonaType === "3D" ||
                                        previousPersonaType === "2.5D") &&
                                    persona.personaType === "2D"
                                ) {
                                    persona.first_scene = "";
                                }
                                previousPersonaType = persona.personaType;
                            }}
                            required
                        >
                            <option value="" disabled
                                >{$t("editPage.typeSelectDefault")}</option
                            >
                            <option value="2D">Chat</option>
                            {#if persona.contentType !== "story"}
                                <option value="2.5D">Live2D(beta)</option>
                                <option value="3D">3D(beta)</option>
                            {/if}
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="visibility"
                            >{$t("editPage.visibilityLabel")}</label
                        >
                        <select
                            id="visibility"
                            bind:value={persona.visibility}
                            required
                        >
                            <option value="public"
                                >{$t("editPage.public")}</option
                            >
                            <option value="private"
                                >{$t("editPage.private")}</option
                            >
                        </select>
                    </div>
                </div>

                <div class="form-section-card">
                    <h2>{$t("editPage.mediaFiles")}</h2>
                    <div class="form-group">
                        <label for="portrait"
                            >{$t("editPage.profileImageLabel")}</label
                        >
                        <div class="file-input-container">
                            <label for="portrait-file" class="file-input-label">
                                <span>{$t("editPage.fileSelect")}</span>
                            </label>
                            <input
                                id="portrait-file"
                                type="file"
                                accept="image/*, video/*"
                                on:change={handleProfileChange}
                                class="file-input-hidden"
                            />
                            {#if portraitFile}
                                <span class="file-name"
                                    >{portraitFile.name}</span
                                >
                            {/if}
                            {#if isCompressing}
                                <div class="upload-status">
                                    <Icon
                                        icon="line-md:loading-twotone-loop"
                                        width="24"
                                        height="24"
                                    />
                                    <span
                                        >Compressing Video... {compression_progress}%</span
                                    >
                                </div>
                            {:else if portrait_progress > 0}
                                <div class="upload-status">
                                    <span
                                        >Uploading... {portrait_progress}%</span
                                    >
                                </div>
                            {/if}
                        </div>
                        {#if portraitPreview}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="portrait-preview clickable"
                                class:has-id={!!persona.id}
                            >
                                <AssetPreview
                                    asset={{
                                        url: portraitPreview,
                                        description: "",
                                    }}
                                />
                            </div>
                        {/if}

                        {#if persona.personaType == "2.5D" && persona.contentType !== "story"}
                            <div class="form-group asset-section">
                                <h3 class="asset-title">Live2D Model Upload</h3>
                                <p class="description">
                                    Upload your Live2D model ZIP file (must
                                    contain model3.json).
                                </p>

                                <div class="file-input-container">
                                    <button
                                        type="button"
                                        class="file-input-label"
                                        on:click={handleLive2DUploadClick}
                                    >
                                        <span>{$t("editPage.fileSelect")}</span>
                                    </button>
                                    <input
                                        id="live2d-file"
                                        type="file"
                                        accept=".zip"
                                        on:change={handleLive2DUpload}
                                        class="file-input-hidden"
                                    />
                                    {#if live2dFile}
                                        <span class="file-name"
                                            >{live2dFile.name}</span
                                        >
                                    {/if}
                                </div>

                                {#if live2d_progress > 0 && live2d_progress < 100}
                                    <div
                                        class="progress-bar-container"
                                        style="margin-top: 10px; height: 5px; background: #eee; border-radius: 3px; overflow: hidden;"
                                    >
                                        <div
                                            class="progress-bar"
                                            style="width: {live2d_progress}%; height: 100%; background: var(--primary);"
                                        ></div>
                                    </div>
                                {/if}

                                {#if persona.live2d_model_url}
                                    <div
                                        class="success-message"
                                        style="margin-top: 10px; color: green;"
                                    >
                                        ✅ Live2D Model Uploaded!
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        {#if persona.personaType == "2D"}
                            <div class="form-group asset-section">
                                <h3 class="asset-title">
                                    {$t("editPage.assetSectionTitle")} ({persona
                                        .image_metadatas.length} / 40)
                                </h3>
                                <p class="description">
                                    {$t("editPage.assetSectionDescription")}
                                </p>

                                <div class="asset-card-list">
                                    {#each persona.image_metadatas as asset, index}
                                        <div class="asset-card">
                                            <div class="asset-image-uploader">
                                                {#if asset.url !== ""}
                                                    <AssetPreview {asset} />
                                                {/if}
                                                {#if assets_progress.has(index)}
                                                    <div
                                                        class="progress-bar-overlay"
                                                    >
                                                        <div
                                                            class="progress-bar"
                                                            style="width: {assets_progress.get(
                                                                index,
                                                            )}%"
                                                        ></div>
                                                    </div>
                                                {/if}
                                                <label
                                                    for="asset-file-{index}"
                                                    class="file-input-label small"
                                                >
                                                    <span
                                                        >{$t(
                                                            "editPage.imageSelect",
                                                        )}</span
                                                    >
                                                </label>
                                                <input
                                                    id="asset-file-{index}"
                                                    type="file"
                                                    accept="image/*, video/*"
                                                    class="file-input-hidden"
                                                    on:change={(e) =>
                                                        handleAssetFileChange(
                                                            e,
                                                            index,
                                                        )}
                                                />
                                            </div>
                                            <div class="asset-details">
                                                <textarea
                                                    class="asset-description-input"
                                                    placeholder={$t(
                                                        "editPage.assetDescriptionPlaceholder",
                                                    )}
                                                    rows="3"
                                                    bind:value={
                                                        asset.description
                                                    }
                                                ></textarea>

                                                <div class="asset-card-actions">
                                                    <div
                                                        class="secret-toggle-group"
                                                    >
                                                        <label
                                                            class="toggle-switch small"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                bind:checked={
                                                                    asset.is_secret
                                                                }
                                                            />
                                                            <span class="slider"
                                                            ></span>
                                                        </label>
                                                        <span
                                                            class="secret-label"
                                                            >{$t(
                                                                "editPage.assets.secretLabel",
                                                            )}</span
                                                        >
                                                        <div
                                                            class="tooltip-icon small"
                                                        >
                                                            <Icon
                                                                icon="ph:question-bold"
                                                            />
                                                            <div
                                                                class="tooltip-text"
                                                            >
                                                                {$t(
                                                                    "editPage.assets.secretTooltip",
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        class="btn btn-secondary btn-copy"
                                                        on:click={() =>
                                                            copyAssetTag(index)}
                                                    >
                                                        {#if copiedState.get(index)}
                                                            <span
                                                                >{$t(
                                                                    "editPage.assets.copySuccess",
                                                                )}</span
                                                            >
                                                        {:else}
                                                            <span
                                                                >{$t(
                                                                    "editPage.assets.copy",
                                                                )}</span
                                                            >
                                                        {/if}
                                                    </button>
                                                    <button
                                                        class="btn-remove asset-remove"
                                                        on:click={() =>
                                                            removeAssetByIndex(
                                                                index,
                                                            )}
                                                    >
                                                        &times;
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>

                                <div class="asset-actions">
                                    <label
                                        for="multiple-asset-upload"
                                        class="btn btn-secondary"
                                    >
                                        {$t("editPage.addAssetButton")}
                                    </label>
                                    <input
                                        id="multiple-asset-upload"
                                        type="file"
                                        multiple
                                        accept="image/*, video/*"
                                        class="file-input-hidden"
                                        on:change={handleMultipleAssetFiles}
                                    />
                                </div>
                            </div>
                        {/if}
                    </div>

                    {#if persona.personaType == "3D" && persona.contentType !== "story"}
                        <div class="form-group">
                            <label for="vrm"
                                >{$t("editPage.vrmFileLabel")}</label
                            >
                            <div class="file-input-container">
                                <button
                                    type="button"
                                    class="btn btn-secondary file-input-label"
                                    on:click={handleVRMUploadClick}
                                >
                                    <span>{$t("editPage.fileSelect")}</span>
                                </button>
                                <input
                                    id="vrm-file"
                                    type="file"
                                    accept=".vrm"
                                    on:change={handleFileChange}
                                    class="file-input-hidden"
                                    bind:this={vrmInput}
                                />
                                {#if vrmFile}
                                    <span class="file-name">{vrmFile.name}</span
                                    >
                                {/if}
                                {#if vrm_progress > 0}
                                    {vrm_progress}%
                                {/if}
                            </div>
                        </div>
                    {/if}

                    {#if (persona.personaType == "3D" || persona.personaType == "2.5D") && persona.contentType !== "story"}
                        <div class="form-group">
                            <label for="voice-select"
                                >{$t("editPage.voiceLabel")}</label
                            >
                            <p class="description">
                                {$t("editPage.voiceDescription")}
                            </p>
                            {#if allVoices.length > 0}
                                <div class="voice-selector">
                                    <select
                                        id="voice-select"
                                        bind:value={selectedVoiceId}
                                    >
                                        <option value="" disabled
                                            >{$t(
                                                "editPage.voiceSelectDefault",
                                            )}</option
                                        >
                                        {#each allVoices as voice (voice.voice_id)}
                                            <option value={voice.voice_id}
                                                >{voice.name}</option
                                            >
                                        {/each}
                                    </select>

                                    {#if selectedVoice}
                                        {#key selectedVoice.voice_id}
                                            <audio
                                                controls
                                                src={selectedVoice.preview_url}
                                            >
                                                Your browser does not support
                                                the audio element.
                                            </audio>
                                        {/key}
                                    {/if}
                                </div>
                            {:else}
                                <p>{$t("editPage.voiceLoading")}</p>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <div class="form-column">
                <div class="form-section-card">
                    <h2>{$t("editPage.aiSettings.title")}</h2>
                    <div class="form-group">
                        <label for="first_scene"
                            >{persona.personaType === "3D" ||
                            persona.personaType === "2.5D"
                                ? $t("editPage.characterSettings.title")
                                : $t("editPage.firstSceneLabel")}</label
                        >
                        {#if persona.personaType === "3D" || persona.personaType === "2.5D"}
                            <!-- FirstSceneBuilder for 3D & 2.5D -->
                            <FirstSceneBuilder
                                initialData={persona.first_scene}
                                {availableExpressions}
                                {availableMotions}
                                mode={persona.personaType === "3D"
                                    ? "3d"
                                    : "live2d"}
                                onChange={(json) => {
                                    firstSceneJson = json;
                                    persona.first_scene = json;

                                    // console.log(persona.first_scene);
                                }}
                            />
                        {:else}
                            <!-- Original textarea for non-3D -->
                            {#if persona.contentType !== "story"}
                                <div class="toggle-container">
                                    <span class:active={!toggleDialogueTag}
                                        >{"{{char}}"}</span
                                    >
                                    <label class="toggle-switch">
                                        <input
                                            type="checkbox"
                                            bind:checked={toggleDialogueTag}
                                        />
                                        <span class="slider"></span>
                                    </label>
                                    <span class:active={toggleDialogueTag}
                                        >{"{{user}}"}</span
                                    >
                                    <div class="tooltip-icon">
                                        <Icon icon="ph:question-bold" />
                                        <div class="tooltip-text">
                                            <p>
                                                <strong>{"{{char}}"}</strong>: {$t(
                                                    "editPage.tooltip.char",
                                                    { default: "캐릭터 이름" },
                                                )}
                                            </p>
                                            <p>
                                                <strong>{"{{user}}"}</strong>: {$t(
                                                    "editPage.tooltip.user",
                                                    { default: "사용자 이름" },
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    class="btn-util"
                                    on:click={insertDialogueTag}
                                >
                                    {$t("editPage.aiSettings.addDialogueTag")}
                                </button>
                            {/if}

                            <p class="description">
                                {$t("editPage.firstSceneDescription")}
                            </p>
                            <textarea
                                id="first_scene"
                                bind:this={firstSceneTextarea}
                                bind:value={persona.first_scene}
                                placeholder={$t(
                                    "editPage.firstScenePlaceholder",
                                )}
                                rows="5"
                                maxlength="2500"
                            ></textarea>
                            <div
                                class="char-counter"
                                class:warning={persona.first_scene.length >
                                    2400}
                                class:error={persona.first_scene.length >= 2500}
                            >
                                {persona.first_scene.length} / 2500
                            </div>
                        {/if}
                    </div>
                    <div class="form-group">
                        {#if persona.personaType !== "3D" && persona.personaType !== "2.5D"}
                            <div class="form-group">
                                <label for="prompt-template"
                                    >{$t(
                                        "editPage.aiSettings.templateSelectLabel",
                                    )}</label
                                >
                                <select
                                    id="prompt-template"
                                    bind:value={selectedTemplate}
                                >
                                    <option value="custom"
                                        >{$t(
                                            "editPage.aiSettings.templateCustom",
                                        )}</option
                                    >
                                    <option value="conversation"
                                        >{$t(
                                            "editPage.aiSettings.templateConversation",
                                        )}</option
                                    >
                                    <option value="simulation"
                                        >{$t(
                                            "editPage.aiSettings.templateSimulation",
                                        )}</option
                                    >
                                    <option value={kintsugiTemplateId}
                                        >{$t(
                                            "editPage.aiSettings.templateKintsugi",
                                        )}</option
                                    >
                                </select>
                            </div>
                        {/if}

                        {#if selectedTemplate !== kintsugiTemplateId}
                            <div class="form-group">
                                <label for="instruction-input"
                                    >{$t("editPage.instructionsLabel")}</label
                                >
                                <p class="description">
                                    {$t("editPage.instructionsDescription")}
                                </p>
                                <textarea
                                    id="instruction-input"
                                    bind:value={singleInstruction}
                                    placeholder={$t(
                                        "editPage.instructionsPlaceholder",
                                    )}
                                    rows="10"
                                    maxlength="3000"
                                ></textarea>
                                <div
                                    class="char-counter"
                                    class:warning={singleInstruction.length >
                                        2500}
                                    class:error={singleInstruction.length >=
                                        3000}
                                >
                                    {singleInstruction.length} / 3000
                                </div>
                            </div>
                        {:else}
                            <div class="kintsugi-fields">
                                <div class="form-group">
                                    <label for="k-description"
                                        >{$t(
                                            "editPage.kintsugi.descriptionLabel",
                                        )}</label
                                    >
                                    <p class="description">
                                        {$t(
                                            "editPage.kintsugi.descriptionDesc",
                                        )}
                                    </p>
                                    <textarea
                                        id="k-description"
                                        bind:value={k_description}
                                        placeholder={$t(
                                            "editPage.kintsugi.descriptionPlaceholder",
                                        )}
                                        rows="5"
                                        maxlength="1000"
                                    ></textarea>
                                    <div
                                        class="char-counter"
                                        class:warning={k_description.length >
                                            900}
                                        class:error={k_description.length >=
                                            1000}
                                    >
                                        {k_description.length} / 1000
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="k-personality"
                                        >{$t(
                                            "editPage.kintsugi.personalityLabel",
                                        )}</label
                                    >
                                    <p class="description">
                                        {$t(
                                            "editPage.kintsugi.personalityDesc",
                                        )}
                                    </p>
                                    <textarea
                                        id="k-personality"
                                        bind:value={k_personality}
                                        placeholder={$t(
                                            "editPage.kintsugi.personalityPlaceholder",
                                        )}
                                        rows="5"
                                        maxlength="1000"
                                    ></textarea>
                                    <div
                                        class="char-counter"
                                        class:warning={k_personality.length >
                                            900}
                                        class:error={k_personality.length >=
                                            1000}
                                    >
                                        {k_personality.length} / 1000
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="k-userPersona"
                                        >{$t(
                                            "editPage.kintsugi.userPersonaLabel",
                                        )}</label
                                    >
                                    <p class="description">
                                        {$t(
                                            "editPage.kintsugi.userPersonaDesc",
                                        )}
                                    </p>
                                    <textarea
                                        id="k-userPersona"
                                        bind:value={k_userPersona}
                                        placeholder={$t(
                                            "editPage.kintsugi.userPersonaPlaceholder",
                                        )}
                                        rows="5"
                                        maxlength="800"
                                    ></textarea>
                                    <div
                                        class="char-counter"
                                        class:warning={k_userPersona.length >
                                            700}
                                        class:error={k_userPersona.length >=
                                            800}
                                    >
                                        {k_userPersona.length} / 800
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="k-scenario">
                                        {$t("editPage.kintsugi.scenarioLabel")}
                                    </label>
                                    <p class="description">
                                        {$t("editPage.kintsugi.scenarioDesc")}
                                    </p>
                                    <textarea
                                        id="k-scenario"
                                        bind:value={k_scenario}
                                        placeholder={$t(
                                            "editPage.kintsugi.scenarioPlaceholder",
                                        )}
                                        rows="2"
                                        maxlength="200"
                                    ></textarea>
                                    <div
                                        class="char-counter"
                                        class:warning={k_scenario.length > 180}
                                        class:error={k_scenario.length >= 200}
                                    >
                                        {k_scenario.length} / 200
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                    <div class="form-group">
                        <label for="tags-container"
                            >{$t("editPage.tagsLabel")}</label
                        >
                        <p class="description">
                            {$t("editPage.tagsDescriptionCategory", {
                                default: "카테고리를 선택하세요.",
                            })}
                        </p>
                        <div
                            class="category-button-container"
                            id="tags-container"
                        >
                            {#each allCategories.filter((category) => category.id < 1000) as category (category.id)}
                                <button
                                    type="button"
                                    class="category-button"
                                    class:active={persona.tags.includes(
                                        category.id.toString(),
                                    )}
                                    class:disabled={persona.tags.length >= 3 &&
                                        !persona.tags.includes(
                                            category.id.toString(),
                                        )}
                                    on:click={() =>
                                        toggleTag(category.id.toString())}
                                >
                                    {$t(category.nameKey)}
                                </button>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Mobile-only save button -->
<button
    class="mobile-save-button"
    type="button"
    disabled={loading || showSuccess}
    on:click={() => {
        const btn = document.querySelector(
            ".header .save-button",
        ) as HTMLButtonElement;
        btn?.click();
    }}
>
    {#if loading}
        <span
            >{$t("editPage.saveButtonLoading")} ({Math.round(
                uploadProgress,
            )}%)</span
        >
    {:else if showSuccess}
        <span>{$t("editPage.saveButtonSuccess")}</span>
    {:else}
        <span>{$t("editPage.saveButton")}</span>
    {/if}
</button>

<LoadingAnimation isOpen={loading} />
<FirstCreationRewardModal bind:isOpen={showRewardModal} />

<style>
    /* --- [신규] Kintsugi 입력창 스타일 --- */
    .kintsugi-fields {
        border-top: 1px solid var(--border);
        padding-top: 1.5rem;
    }
    .kintsugi-fields .form-group:last-child {
        margin-bottom: 0;
    }
    .kintsugi-fields label {
        font-weight: 600;
    }
    .kintsugi-fields p.description {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin-top: -0.25rem;
        margin-bottom: 0.75rem;
    }
    /* ----------------------------------- */

    .portrait-preview {
        margin-top: 1rem;
        width: 150px;
        height: 150px;
        border-radius: var(--radius-input);
        object-fit: cover;
        border: 1px solid var(--border);
        overflow: hidden;
    }

    .gif-like-video {
        pointer-events: none;
    }

    /* === 기본 레이아웃 === */
    .container {
        height: 100%;
        display: flex;
        flex-direction: column;
        background-color: var(--background);
        color: var(--foreground);
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1.5rem;
        box-sizing: border-box;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 0;
        flex-shrink: 0;
        border-bottom: 1px solid var(--border);
    }

    .scrollable-content {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
        padding-top: 1.5rem;
    }
    /* 스크롤바 디자인 */
    .scrollable-content::-webkit-scrollbar {
        width: 8px;
    }
    .scrollable-content::-webkit-scrollbar-track {
        background: transparent;
    }
    .scrollable-content::-webkit-scrollbar-thumb {
        background: var(--muted-foreground);
        border-radius: 4px;
    }
    .scrollable-content::-webkit-scrollbar-thumb:hover {
        background: var(--foreground-alt);
    }

    /* === 2단 폼 레이아웃 === */
    .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 1.5rem;
        align-items: start;
    }

    .form-column {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .form-section-card {
        background-color: var(--card);
        border: 1px solid var(--border-card);
        border-radius: var(--radius-card);
        padding: 1.5rem;
    }
    .form-section-card h2 {
        margin-top: 0;
        margin-bottom: 1.5rem;
        font-size: 1.25rem;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.75rem;
    }

    /* === 폼 요소 공통 스타일 === */
    .form-group {
        margin-bottom: 1.5rem;
    }
    .form-group:last-child {
        margin-bottom: 0;
    }
    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
    }
    .description {
        font-size: 0.85rem;
        color: var(--muted-foreground);
        margin-top: -0.25rem;
        margin-bottom: 0.75rem;
    }
    input,
    select,
    textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--border-input);
        border-radius: var(--radius-input);
        background: var(--input);
        color: var(--foreground);
        box-sizing: border-box;
        transition:
            border-color 0.2s,
            box-shadow 0.2s;
    }
    input:focus,
    select:focus,
    textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--ring);
    }

    .category-button.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .input-group {
        display: flex;
        gap: 0.5rem;
    }
    .input-group > :first-child {
        flex: 1;
    }

    /* === 커스텀 파일 업로드 === */
    .file-input-hidden {
        display: none;
    }
    .file-input-container {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .file-input-label {
        display: inline-block;
        padding: 0.6rem 1.2rem;
        background-color: var(--secondary);
        border: 1px solid var(--border);
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .file-input-label:hover {
        background-color: var(--muted);
    }
    .file-name {
        font-size: 0.9rem;
        color: var(--muted-foreground);
    }
    .preview-image {
        margin-top: 1rem;
        max-width: 150px;
        max-height: 150px;
        border-radius: var(--radius-input);
        object-fit: cover;
        border: 1px solid var(--border);
    }

    /* === 동적 아이템 리스트 === */
    .item-list {
        list-style: none;
        padding: 0;
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        background: var(--muted);
        padding: 0.75rem;
        border-radius: var(--radius-card-sm);
        font-size: 0.9rem;
        line-height: 1.5;
        word-break: break-word;
    }
    .item-text {
        white-space: pre-wrap;
    }

    /* .tag-list, .tag-item 삭제됨 */

    /* === 버튼 === */
    .btn {
        padding: 0.6rem 1.2rem;
        font-size: 0.9rem;
        font-weight: 600;
        border: 1px solid var(--border);
        border-radius: var(--radius-button);
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-secondary {
        background: var(--secondary);
        color: var(--secondary-foreground);
    }
    .btn-secondary:hover:not(:disabled) {
        opacity: 0.9;
    }

    /* .btn-add-emphasis, @keyframes pulse 삭제됨 */

    .btn-remove {
        background: none;
        border: none;
        color: var(--muted-foreground);
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        padding: 0 0.25rem;
    }
    .btn-remove:hover {
        color: var(--destructive);
    }

    .save-button {
        padding: 0.6rem 1.2rem;
        font-size: 0.9rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background: var(--primary-gradient);
        border: 1px solid var(--primary-gradient);
        color: var(--primary-foreground);

        background-size: 200% 200%;
        animation: gradient-animation 3s ease infinite;
    }
    .save-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .save-button:hover:not(:disabled) {
        opacity: 0.9;
    }

    /* Mobile: Hide header button, show fixed button at bottom */
    @media (max-width: 768px) {
        .header .save-button {
            display: none; /* Hide button in header on mobile */
        }

        .container {
            padding-bottom: 80px; /* Space for fixed button */
        }
    }

    /* Mobile-only fixed save button */
    @media (max-width: 768px) {
        .mobile-save-button {
            display: block;
            position: fixed;
            bottom: calc(
                70px + env(safe-area-inset-bottom)
            ); /* Above navigation bar */
            left: 0;
            right: 0;
            width: 100%;
            padding: 1rem;
            font-size: 1rem;
            font-weight: 600;
            border-radius: 0;
            cursor: pointer;
            transition: all 0.2s;
            background: var(--primary-gradient);
            border: none;
            border-top: 1px solid var(--border);
            color: var(--primary-foreground);
            z-index: 10001; /* Ensure above nav bar */
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
            background-size: 200% 200%;
            animation: gradient-animation 3s ease infinite;
        }

        .mobile-save-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .container {
            padding-bottom: calc(
                160px + env(safe-area-inset-bottom)
            ); /* Space for nav bar + save button */
        }
    }

    /* Hide mobile button on desktop */
    @media (min-width: 769px) {
        .mobile-save-button {
            display: none;
        }
    }

    .error {
        color: var(--destructive);
        background-color: hsla(var(--destructive), 0.1);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
    }

    .char-counter {
        font-size: 0.8rem;
        color: var(--muted-foreground);
        text-align: right;
        margin-top: 0.25rem;
    }
    .char-counter.warning {
        color: orange;
    }
    .char-counter.error {
        color: var(--destructive);
    }

    .voice-selector {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .voice-selector select {
        flex: 1;
    }

    .voice-selector audio {
        height: 42px;
    }

    .voice-selector audio::-webkit-media-controls-panel {
        background-color: var(--muted);
        color: var(--foreground);
    }
    .voice-selector audio::-webkit-media-controls-play-button,
    .voice-selector audio::-webkit-media-controls-timeline,
    .voice-selector audio::-webkit-media-controls-current-time-display,
    .voice-selector audio::-webkit-media-controls-time-remaining-display,
    .voice-selector audio::-webkit-media-controls-volume-slider,
    .voice-selector audio::-webkit-media-controls-mute-button {
        filter: invert(1) grayscale(1) brightness(1.5);
    }

    .asset-section {
        border-top: 1px solid var(--border);
        margin-top: 1.5rem;
        padding-top: 1.5rem;
    }

    .asset-title {
        font-size: 1.1rem;
        margin: 0 0 0.5rem 0;
    }

    .asset-card-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .asset-card {
        display: flex;
        gap: 1rem;
        background-color: var(--muted);
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--border);
    }

    .asset-image-uploader {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 120px;
        height: 120px;
        flex-shrink: 0;
        background-color: var(--background);
        border-radius: 6px;
        position: relative;
        overflow: hidden;
    }

    .asset-preview-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 6px;
    }

    .file-input-label.small {
        padding: 0.4rem 0.8rem;
        font-size: 0.8rem;
        position: absolute;
        bottom: 8px;
    }

    .asset-details {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        position: relative;
    }

    .asset-card-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    .btn-copy {
        padding: 0.4rem 0.8rem;
        font-size: 0.8rem;
        flex-grow: 1; /* 버튼이 남은 공간을 채우도록 설정 */
    }

    .asset-remove {
        position: static; /* 기존 absolute 포지셔닝 제거 */
        top: auto;
        right: auto;
        width: auto;
        height: auto;
        background-color: transparent;
    }

    .asset-description-input {
        flex-grow: 1;
        resize: vertical;
    }

    /* Tooltip Styles */
    .tooltip-icon {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-left: 0.5rem;
        cursor: help;
        color: var(--muted-foreground);
    }
    .tooltip-text {
        visibility: hidden;
        width: max-content;
        max-width: 250px;
        min-width: 150px;
        background-color: var(--popover);
        color: var(--popover-foreground);
        text-align: left;
        border-radius: 6px;
        padding: 0.8rem;
        position: absolute;
        z-index: 10;
        bottom: 130%;
        left: 50%;
        transform: translateX(-50%);
        opacity: 0;
        transition: opacity 0.2s;
        box-shadow: var(--shadow-popover);
        border: 1px solid var(--border);
        font-size: 0.85rem;
        pointer-events: none;
        word-wrap: break-word;
        white-space: normal;
    }
    .tooltip-text p {
        margin: 0.2rem 0;
    }
    .tooltip-icon:hover .tooltip-text {
        visibility: visible;
        opacity: 1;
    }

    .asset-remove {
        position: absolute;
        top: -8px;
        right: -8px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background-color: var(--card);
    }

    .asset-actions {
        display: flex;
        gap: 0.5rem;
    }

    .progress-bar-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: flex-start;
    }

    .progress-bar {
        width: 0%;
        height: 5px;
        background-color: var(--primary);
        transition: width 0.2s ease-in-out;
    }
    /* --- 새 카테고리 버튼 스타일 --- */
    .category-button-container {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        padding-top: 0.25rem;
    }
    .category-button {
        padding: 0.5rem 1rem;
        border-radius: 999px; /* 타원형 모양 */
        border: 1px solid var(--border);
        background-color: var(--muted);
        color: var(--muted-foreground);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
    }
    .category-button:not(.active):hover {
        background-color: var(--secondary);
        border-color: var(--border-hover);
        transform: translateY(-1px);
    }
    .category-button.active {
        background: var(--primary-gradient);
        color: var(--primary-foreground);
        border-color: transparent;
        font-weight: 600;
    }

    .label-with-button {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    .label-with-button label {
        margin-bottom: 0; /* label의 기본 마진 제거 */
    }
    .btn-util {
        padding: 0.25rem 0.75rem;
        font-size: 0.8rem;
        font-weight: 600;
        border: 1px solid var(--border);
        border-radius: var(--radius-button);
        background: var(--secondary);
        color: var(--secondary-foreground);
        cursor: pointer;
        transition: all 0.2s;
    }
    .btn-util:hover {
        opacity: 0.9;
    }
    .toggle-container {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-family: monospace; /* {{ }}가 잘 보이도록 */
        font-size: 0.9em;
    }
    .toggle-container span {
        color: var(--muted-foreground);
        transition: color 0.2s;
    }
    .toggle-container span.active {
        color: var(--primary);
        font-weight: bold;
    }
    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 34px;
        height: 20px;
    }
    .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--muted);
        transition: 0.4s;
        border-radius: 20px;
    }
    .slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.4s;
        border-radius: 50%;
    }
    input:checked + .slider {
        background-color: var(--primary);
    }
    input:checked + .slider:before {
        transform: translateX(14px);
    }

    /* Secret Toggle Styles */
    .secret-toggle-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background-color: var(--background);
        padding: 0.3rem 0.6rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        white-space: nowrap; /* Prevent text wrapping inside */
    }
    .secret-toggle-group label {
        margin-bottom: 0; /* Override global label margin */
    }
    .secret-label {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--secondary-foreground);
    }
    .toggle-switch.small {
        width: 28px;
        height: 16px;
    }
    .toggle-switch.small .slider:before {
        height: 12px;
        width: 12px;
        left: 2px;
        bottom: 2px;
    }
    .toggle-switch.small input:checked + .slider:before {
        transform: translateX(12px);
    }
    .tooltip-icon.small {
        margin-left: 0.1rem;
        font-size: 0.85rem;
    }
    .tooltip-icon.small .tooltip-text {
        bottom: 150%;
    }

    /* Responsive adjustment for asset card actions */
    @media (max-width: 480px) {
        .asset-card-actions {
            flex-direction: column;
            gap: 0.8rem;
            align-items: flex-end; /* Align to right */
        }
        .secret-toggle-group {
            width: fit-content;
        }
        .btn-copy {
            width: 100%;
        }
    }

    .header-actions {
        display: flex;
        gap: 1rem;
        align-items: center;
    }

    .chat-button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border-radius: var(--radius-button);
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid var(--border);
        background: var(--secondary);
        color: var(--secondary-foreground);
    }

    .chat-button:hover {
        background: var(--secondary-hover);
        transform: translateY(-1px);
    }

    .chat-button.secondary {
        /* Additional secondary styling if needed */
    }

    .portrait-preview.clickable {
        cursor: pointer;
        position: relative;
        overflow: hidden;
        border-radius: var(--radius-card);
    }

    .portrait-preview.clickable.has-id:hover .chat-overlay {
        opacity: 1;
    }

    .chat-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        opacity: 0;
        transition: opacity 0.2s;
        gap: 0.5rem;
        font-weight: 600;
        backdrop-filter: blur(2px);
    }

    .content-type-selector {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .content-type-selector button {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
    }

    .content-type-selector button:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .content-type-selector button.active {
        background: rgba(59, 130, 246, 0.15);
        border-color: #3b82f6;
        color: #fff;
    }

    .content-type-selector .text {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .content-type-selector .title {
        font-weight: 600;
        font-size: 1rem;
    }

    .content-type-selector .desc {
        font-size: 0.8rem;
        opacity: 0.7;
    }
</style>

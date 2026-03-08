import { api } from "$lib/api";

export type VoiceCloneStatus = {
    model_id: string;
    title: string;
    state: "created" | "training" | "trained" | "failed" | string;
    visibility: string;
    type: string;
    created_at: string;
    updated_at: string;
};

export type CreateVoiceCloneInput = {
    personaType: string;
    title: string;
    description?: string;
    visibility?: "private" | "unlist" | "public";
    enhanceAudioQuality?: boolean;
    voices: File[];
    texts?: string[];
    tags?: string[];
};

export async function createVoiceClone(
    input: CreateVoiceCloneInput,
): Promise<VoiceCloneStatus> {
    const form = new FormData();
    form.append("persona_type", input.personaType);
    form.append("title", input.title);
    form.append("visibility", input.visibility ?? "private");
    form.append(
        "enhance_audio_quality",
        input.enhanceAudioQuality ? "true" : "false",
    );
    if (input.description?.trim()) {
        form.append("description", input.description.trim());
    }
    (input.tags || []).forEach((tag) => {
        if (tag.trim()) form.append("tags", tag.trim());
    });
    (input.texts || []).forEach((text) => {
        if (text.trim()) form.append("texts", text.trim());
    });
    input.voices.forEach((file) => form.append("voices", file, file.name));

    const res = await api.postForm("/api/voice-clone", form);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create voice clone");
    }
    return (await res.json()) as VoiceCloneStatus;
}

export async function getVoiceCloneStatus(modelId: string): Promise<VoiceCloneStatus> {
    const res = await api.get(`/api/voice-clone/status?id=${encodeURIComponent(modelId)}`);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch voice clone status");
    }
    return (await res.json()) as VoiceCloneStatus;
}

export async function testVoiceCloneSynthesis(
    voiceId: string,
    text: string,
): Promise<Blob> {
    const res = await api.post("/api/voice-clone/test", {
        voice_id: voiceId,
        text,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Voice clone test failed");
    }
    return await res.blob();
}


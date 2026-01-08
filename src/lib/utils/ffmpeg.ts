import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export class FFmpegManager {
    private static instance: FFmpegManager;
    private ffmpeg: FFmpeg;
    private loaded: boolean = false;
    private loadingPromise: Promise<void> | null = null;
    private loadError: string | null = null;

    private constructor() {
        this.ffmpeg = new FFmpeg();
    }

    public static getInstance(): FFmpegManager {
        if (!FFmpegManager.instance) {
            FFmpegManager.instance = new FFmpegManager();
        }
        return FFmpegManager.instance;
    }

    public async load(): Promise<void> {
        if (this.loaded) return;
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = (async () => {
            try {
                const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
                await this.ffmpeg.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
                });
                this.loaded = true;
                console.log("FFmpeg loaded successfully");
            } catch (e: any) {
                console.error("FFmpeg load failed:", e);
                this.loadError = e.message;
                this.loadingPromise = null; // Allow retry
                throw e;
            }
        })();

        return this.loadingPromise;
    }

    public async compressVideo(
        file: File,
        onProgress?: (progress: number) => void
    ): Promise<File> {
        if (!this.loaded) {
            await this.load();
        }

        const { ffmpeg } = this;
        const inputName = "input.mp4"; // Normalize input name
        const outputName = "output.mp4";

        try {
            // Write input file to memory
            await ffmpeg.writeFile(inputName, await fetchFile(file));

            // Progress handler
            if (onProgress) {
                ffmpeg.on("progress", ({ progress }) => {
                    onProgress(Math.round(progress * 100));
                });
            }

            // Run compression command
            // CRF 28 is a good balance for web (lower is better quality, higher is lower size)
            // Preset 'fast' or 'faster' speeds up encoding
            await ffmpeg.exec([
                "-i", inputName,
                "-c:v", "libx264",
                "-crf", "28",
                "-preset", "fast",
                "-c:a", "aac",
                "-b:a", "128k",
                outputName
            ]);

            // Read output file
            const data = await ffmpeg.readFile(outputName);

            // Cleanup
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);

            // Return as File
            return new File([data as any], file.name, { type: "video/mp4" });

        } catch (e) {
            console.error("Video compression failed:", e);
            throw e;
        }
    }
}

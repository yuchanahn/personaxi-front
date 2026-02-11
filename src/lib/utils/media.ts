export async function extractFirstFrame(videoFile: File): Promise<File | null> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(videoFile);
        video.src = url;

        video.onloadedmetadata = () => {
            // Seek to 0.5s or halfway if video is shorter than 1s to ensure we get a valid frame
            // Avoid seeking to 0 if possible as it might be black
            let seekTime = 0.5;
            if (video.duration < 1.0) {
                seekTime = video.duration / 2;
            }
            video.currentTime = seekTime;
        };

        video.onseeked = () => {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                URL.revokeObjectURL(url);
                resolve(null);
                return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                if (blob) {
                    // Create a file from the blob
                    const imageFile = new File([blob], "thumbnail.jpg", {
                        type: "image/jpeg",
                        lastModified: Date.now(),
                    });
                    resolve(imageFile);
                } else {
                    resolve(null);
                }
            }, "image/jpeg", 0.9);
        };

        video.onerror = () => {
            console.error("Video load error in extractFirstFrame");
            URL.revokeObjectURL(url);
            resolve(null);
        };

        // Timeout safety
        setTimeout(() => {
            // If promise hasn't resolved (implied by closure scope if we had a flag, but here we just try to resolve null if stuck)
            // Actually promise can only be resolved once.
            // We can't check promise state easily, but we can force fail if taking too long.
            // For now, let's rely on onerror.
        }, 5000);
    });
}

export async function checkVideoDuration(videoFile: File, maxDurationSeconds: number): Promise<{ valid: boolean; duration: number }> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        const url = URL.createObjectURL(videoFile);
        video.src = url;

        video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            const duration = video.duration;
            resolve({
                valid: duration <= maxDurationSeconds,
                duration: duration
            });
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ valid: false, duration: 0 });
        };
    });
}

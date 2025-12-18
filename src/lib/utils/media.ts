export async function extractFirstFrame(videoFile: File): Promise<File | null> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(videoFile);
        video.src = url;

        video.onloadeddata = () => {
            // Some browsers need a seek to render the frame
            video.currentTime = 0.5; // seek to 0.5s to avoid black frame if starts with black
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
                    const imageFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
                    resolve(imageFile);
                } else {
                    resolve(null);
                }
            }, "image/jpeg", 0.9);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
    });
}

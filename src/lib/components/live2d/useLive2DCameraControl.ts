type CreateLive2DCameraControlOptions = {
    getApp: () => any | null;
    getCurrentModel: () => any | null;
    getX: () => number;
    getY: () => number;
    getIsCloseup: () => boolean;
    getCloseupScale: () => number;
    getCloseupOffset: () => number;
};

export function createLive2DCameraControl({
    getApp,
    getCurrentModel,
    getX,
    getY,
    getIsCloseup,
    getCloseupScale,
    getCloseupOffset,
}: CreateLive2DCameraControlOptions) {
    const onResize = () => {
        const app = getApp();
        const model = getCurrentModel();
        if (!app || !model) return;
        if (getX() !== 0 || getY() !== 0) return;

        const bounds = model.getBounds();
        const modelWidth = bounds.width / model.scale.x;
        const modelHeight = bounds.height / model.scale.y;

        const paddingFactor = 1.3;
        const scaleX = (app.screen.width * paddingFactor) / modelWidth;
        const scaleY = (app.screen.height * paddingFactor) / modelHeight;
        let autoScale = Math.min(scaleX, scaleY);
        let targetY = app.screen.height / 2 + 50;

        if (getIsCloseup()) {
            autoScale *= getCloseupScale();
            const visualHeight = modelHeight * autoScale;
            targetY += visualHeight * getCloseupOffset();
        } else {
            const visualHeight = modelHeight * autoScale;
            targetY += visualHeight * 0.1;
        }

        model.scale.set(autoScale);
        model.x = app.screen.width / 2;
        model.y = targetY;
    };

    const attach = () => {
        window.addEventListener("resize", onResize);
    };

    const detach = () => {
        window.removeEventListener("resize", onResize);
    };

    return {
        onResize,
        attach,
        detach,
    };
}

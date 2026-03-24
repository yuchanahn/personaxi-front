type CursorPosition = {
    x: number;
    y: number;
};

type CreateLive2DInteractionControlOptions = {
    getApp: () => any | null;
    getAutonomy: () => any | null;
    onCursorChange: (pos: CursorPosition, visible: boolean) => void;
    onDragStateChange: (isDragging: boolean) => void;
    onInteractionStart: () => void;
    onInteractionEnd: () => void;
};

export function createLive2DInteractionControl({
    getApp,
    getAutonomy,
    onCursorChange,
    onDragStateChange,
    onInteractionStart,
    onInteractionEnd,
}: CreateLive2DInteractionControlOptions) {
    let detach: (() => void) | null = null;
    let isDragging = false;
    let isPointerDown = false;
    let startX = 0;
    let startY = 0;
    const dragThreshold = 10;

    const clamp = (val: number, min: number, max: number) =>
        Math.min(Math.max(val, min), max);

    const updateDragTarget = (event: any) => {
        const app = getApp();
        const autonomy = getAutonomy();
        if (!app || !autonomy) return;

        const x = event.data.global.x;
        const y = event.data.global.y;
        const centerX = app.screen.width / 2;
        const centerY = app.screen.height / 2;

        const targetX = clamp((x - centerX) / (app.screen.width / 3), -1, 1);
        const targetY = clamp((y - centerY) / (app.screen.height / 3), -1, 1);
        autonomy.handleDrag(targetX, targetY);
    };

    const bind = (model: any) => {
        if (detach) {
            detach();
            detach = null;
        }

        model.interactive = true;
        model.buttonMode = true;
        if ("eventMode" in model) {
            model.eventMode = "static";
        }
        if ("cursor" in model) {
            model.cursor = "grab";
        }

        const pointerDown = (event: any) => {
            isPointerDown = true;
            startX = event.data.global.x;
            startY = event.data.global.y;
            onCursorChange({ x: startX, y: startY }, true);
            updateDragTarget(event);
        };

        const pointerMove = (event: any) => {
            if (!isPointerDown) return;

            const x = event.data.global.x;
            const y = event.data.global.y;
            onCursorChange({ x, y }, true);

            if (!isDragging && startX !== 0 && startY !== 0) {
                const dx = Math.abs(x - startX);
                const dy = Math.abs(y - startY);
                if (dx > dragThreshold || dy > dragThreshold) {
                    isDragging = true;
                    onDragStateChange(true);
                    onInteractionStart();
                    getAutonomy()?.WakeUp();
                }
            }

            if (isDragging) {
                updateDragTarget(event);
            }
        };

        const stopDrag = () => {
            isPointerDown = false;
            if (isDragging) {
                onInteractionEnd();
            }
            isDragging = false;
            onDragStateChange(false);
            onCursorChange({ x: 0, y: 0 }, false);
            startX = 0;
            startY = 0;
            getAutonomy()?.handleDrag(0, 0);
        };

        model.on("pointerdown", pointerDown);
        model.on("pointermove", pointerMove);
        model.on("pointerupoutside", stopDrag);
        model.on("pointerup", stopDrag);

        detach = () => {
            if (typeof model.off === "function") {
                model.off("pointerdown", pointerDown);
                model.off("pointermove", pointerMove);
                model.off("pointerupoutside", stopDrag);
                model.off("pointerup", stopDrag);
            }
            stopDrag();
        };
    };

    const destroy = () => {
        if (detach) {
            detach();
            detach = null;
        }
    };

    return {
        bind,
        destroy,
    };
}

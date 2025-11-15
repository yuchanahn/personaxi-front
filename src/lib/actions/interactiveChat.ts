export function interactiveChat(node: HTMLElement, callback: (payload: string) => void) {

    let queue: string[] = [];

    function getLastActiveElement(selector: string): HTMLElement | null {
        const allActiveElements = node.querySelectorAll(selector + ":not(.used)");
        if (allActiveElements.length === 0) {
            return null;
        }
        return allActiveElements[allActiveElements.length - 1] as HTMLElement;
    }

    const handleClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;

        const choiceButton = target.closest(".game-choice:not(.used)") as HTMLElement;
        const inputEnd = getLastActiveElement(".game-input-end") as HTMLElement;

        if (inputEnd && target === inputEnd) {
            const allInputFields = node.querySelectorAll(".game-input:not(.used)") as NodeListOf<HTMLInputElement>;

            allInputFields.forEach((field) => {
                if (field.value.trim() !== "") {
                    const fieldId = field.dataset.id || "UNNAMED";
                    queue.push(`inputField [ID: ${fieldId}]: ${field.value.trim()}`);
                }
            });
            callback("PlayerINPUT: " + queue.join("\n"));

            queue = [];

            const counter = getLastActiveElement(".game-choice-counter");
            if (counter) counter.classList.add("used");

            const input = getLastActiveElement(".game-input");
            if (input) input.classList.add("used");

            const endBtn = getLastActiveElement(".game-input-end");
            if (endBtn) endBtn.classList.add("used");

            const lastCounter = getLastActiveElement(".game-choice-counter");
            if (lastCounter) {
                const parent = lastCounter.closest("div, form, p");
                if (parent) {
                    parent.querySelectorAll(".game-choice:not(.used)").forEach(btn => {
                        btn.classList.add("used");
                    });
                }
            }

            return;
        }

        if (!choiceButton) {
            return;
        }

        const choiceCounter = getLastActiveElement(".game-choice-counter") as HTMLElement;

        if (!choiceCounter) {
            return;
        }

        const textContent = choiceCounter.textContent || "0";
        const match = textContent.match(/\d+/);

        let originalNumberString = "1"
        if (match) {
            originalNumberString = match[0];
        }

        let currentPoints = parseInt(originalNumberString, 10);

        if (currentPoints >= 1) {
            currentPoints--;
            choiceCounter.textContent = textContent.replace(originalNumberString, currentPoints.toString());
        } else {
            console.log("포인트가 부족합니다.");
            return;
        }

        event.preventDefault();

        const action = choiceButton.dataset.action;
        const id = choiceButton.dataset.id;
        const value = choiceButton.dataset.value;
        const randomMin = choiceButton.dataset.randomMin;
        const randomMax = choiceButton.dataset.randomMax;

        let payload = "";

        if (action === "random") {
            let min = 1;
            let max = 100;
            if (randomMin) {
                min = parseInt(randomMin, 10);
            }
            if (randomMax) {
                max = parseInt(randomMax, 10);
            }
            const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
            payload = `[Button Clicked [ID: ${id}] : RAND = ${randomValue}]`;

        } else if (action === "random2") {
            let min = 1;
            let max = 100;
            if (randomMin) {
                min = parseInt(randomMin, 10);
            }
            if (randomMax) {
                max = parseInt(randomMax, 10);
            }
            const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
            const finalValue = (Math.random() < 0.5 ? -1 : 1) * randomValue;
            payload = `[Button Clicked [ID: ${id}] : RAND = ${finalValue}]`;
        }
        else if (action === "select-option" && value) {
            payload = `[Button Clicked [ID: ${id}] : ${value}]`;
        } else {
            payload = choiceButton.textContent?.trim() || "Button Clicked";
        }
        queue.push(payload);

        const anyActiveEndBtn = getLastActiveElement(".game-input-end");

        if (currentPoints === 0 && !anyActiveEndBtn) {
            console.log("No Active End button found ANYWHERE & points are 0. Auto-firing!");

            const allInputFields = node.querySelectorAll(".game-input:not(.used)") as NodeListOf<HTMLInputElement>;
            allInputFields.forEach((field) => {
                if (field.value.trim() !== "") {
                    const fieldId = field.dataset.id || "UNNAMED";
                    queue.push(`inputField [ID: ${fieldId}]: ${field.value.trim()}`);
                }
            });

            callback("PlayerINPUT: " + queue.join("\n"));
            queue = [];

            choiceCounter.classList.add("used");

            const counterParent = choiceCounter.closest("div, p");
            if (counterParent) {
                counterParent.querySelectorAll(".game-choice:not(.used)").forEach(btn => {
                    btn.classList.add("used");
                });
                const parentInput = counterParent.parentElement?.querySelector(".game-input:not(.used)");
                if (parentInput) parentInput.classList.add("used");
            }
        }
    };

    node.addEventListener("click", handleClick);

    return {
        destroy() {
            node.removeEventListener("click", handleClick);
        },
    };
}
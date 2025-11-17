import { generateSajuAnalysisPrompt } from "$lib/components/saju/SajuTest";

export function interactiveChat(node: HTMLElement, callback: (payload: string) => void) {

    let queue: string[] = [];

    function getLastActiveElement(selector: string): HTMLElement | null {
        const allActiveElements = node.querySelectorAll(selector + ":not(.used)");
        if (allActiveElements.length === 0) {
            return null;
        }
        return allActiveElements[allActiveElements.length - 1] as HTMLElement;
    }

    function getLastActiveElements(selector: string): NodeListOf<HTMLInputElement> | null {
        const allActiveElements = node.querySelectorAll(selector + ":not(.used)") as NodeListOf<HTMLInputElement>;
        if (allActiveElements.length === 0) {
            return null;
        }
        return allActiveElements;
    }

    const handleClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;

        const choiceButton = target.closest(".game-choice:not(.used)") as HTMLElement;
        const inputEnd = getLastActiveElement(".game-input-end") as HTMLElement;

        let birthDate: Date | null = null;
        let birthHour: number | null = null;
        let birthMinute: number | null = null;
        let gender: "남" | "여" = "남";
        let push = false;

        const setSaju = (fieldId: string, field: HTMLInputElement) => {
            if (fieldId === "saju_date") {
                birthDate = new Date(field.value.trim());
            }
            if (fieldId === "saju_time") {
                const timeParts = field.value.trim().split(":");
                birthHour = parseInt(timeParts[0], 10);
                birthMinute = parseInt(timeParts[1], 10);
            }
            if (fieldId === "saju_gender") {
                gender = field.value.trim() as "남" | "여";
            }

            if (!push && birthDate && birthHour !== null && birthMinute !== null) {
                const prompt = generateSajuAnalysisPrompt(birthDate, birthHour, birthMinute, gender);
                queue.push("\n계산: " + prompt);
                push = true;
            }
        }

        if (inputEnd && target === inputEnd) {
            const allInputFields = node.querySelectorAll(".game-input:not(.used)") as NodeListOf<HTMLInputElement>;



            allInputFields.forEach((field) => {
                if (field.value.trim() !== "") {
                    const fieldId = field.dataset.id || "UNNAMED";
                    queue.push(`inputField [ID: ${fieldId}]: ${field.value.trim()}`);

                    setSaju(fieldId, field);
                }
            });
            callback("<system-input>" + queue.join("\n") + "</system-input>");

            queue = [];

            const counter = getLastActiveElement(".game-choice-counter");
            if (counter) counter.classList.add("used");

            const input = getLastActiveElements(".game-input");
            if (input) {
                input.forEach((field) => {
                    field.classList.add("used");
                });
            }


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

        let currentPoints = 1;

        if (choiceCounter) {
            const textContent = choiceCounter.textContent || "0";
            const match = textContent.match(/\d+/);

            let originalNumberString = "1"
            if (match) {
                originalNumberString = match[0];
            }

            currentPoints = parseInt(originalNumberString, 10);

            if (currentPoints >= 1) {
                currentPoints--;
                choiceCounter.textContent = textContent.replace(originalNumberString, currentPoints.toString());
            } else {
                console.log("포인트가 부족합니다.");
                return;
            }
        } else {
            currentPoints = 0;
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
                    setSaju(fieldId, field);
                }
                field.classList.add("used");
            });

            callback("<system-input>" + queue.join("\n") + "</system-input>");
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
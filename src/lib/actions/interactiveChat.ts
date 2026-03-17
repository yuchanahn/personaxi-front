import { generateSajuAnalysisPrompt } from "$lib/components/saju/SajuTest";
import { parseBirthDate, parseBirthTime, parseGender } from "$lib/components/utils/sajuParse";
import {
    extractAstrologyInput,
    generateAstrologyAnalysisPrompt,
} from "$lib/components/astrology/astrologyPrompt";

type InteractiveChatParams = {
    callback: (payload: string) => void;
    resetKey?: string | number;
};

type InteractiveGroupElement = HTMLElement;

const LEGACY_GROUP_ID = "__legacy__";
const VALIDATION_CLASS = "game-validation-message";

export function interactiveChat(
    node: HTMLElement,
    params: InteractiveChatParams | ((payload: string) => void),
) {
    let callback =
        typeof params === "function" ? params : params.callback;
    let resetKey =
        typeof params === "function" ? undefined : params.resetKey;

    let queueByGroup = new Map<string, string[]>();
    let stateByGroup = new Map<string, Map<string, string>>();

    function resetInteractiveState() {
        queueByGroup = new Map();
        stateByGroup = new Map();
    }

    function getQueue(groupId: string) {
        const existing = queueByGroup.get(groupId);
        if (existing) return existing;
        const next: string[] = [];
        queueByGroup.set(groupId, next);
        return next;
    }

    function clearQueue(groupId: string) {
        queueByGroup.delete(groupId);
    }

    function getState(groupId: string) {
        const existing = stateByGroup.get(groupId);
        if (existing) return existing;
        const next = new Map<string, string>();
        stateByGroup.set(groupId, next);
        return next;
    }

    function getGroupElement(source: HTMLElement | null): InteractiveGroupElement {
        return (
            source?.closest(".game-ui-group") as InteractiveGroupElement | null
        ) ?? node;
    }

    function getGroupId(groupEl: InteractiveGroupElement) {
        return groupEl.dataset.group || groupEl.dataset.groupId || LEGACY_GROUP_ID;
    }

    function getActiveElementWithinGroup<T extends HTMLElement>(
        groupEl: InteractiveGroupElement,
        selector: string,
    ): T | null {
        return groupEl.querySelector(`${selector}:not(.used)`) as T | null;
    }

    function getActiveElementsWithinGroup<T extends HTMLElement>(
        groupEl: InteractiveGroupElement,
        selector: string,
    ): NodeListOf<T> {
        return groupEl.querySelectorAll(`${selector}:not(.used)`) as NodeListOf<T>;
    }

    function getAllElementsWithinGroup<T extends HTMLElement>(
        groupEl: InteractiveGroupElement,
        selector: string,
    ): NodeListOf<T> {
        return groupEl.querySelectorAll(selector) as NodeListOf<T>;
    }

    function clearValidationMessage(groupEl: InteractiveGroupElement) {
        groupEl.querySelector(`.${VALIDATION_CLASS}`)?.remove();
    }

    function showValidationMessage(
        groupEl: InteractiveGroupElement,
        message: string,
    ) {
        let el = groupEl.querySelector(`.${VALIDATION_CLASS}`) as HTMLElement | null;
        if (!el) {
            el = document.createElement("div");
            el.className = VALIDATION_CLASS;
            groupEl.appendChild(el);
        }
        el.textContent = message;
    }

    function getButtonPayload(button: HTMLElement) {
        const action = button.dataset.action;
        const id = button.dataset.id;
        const value = button.dataset.value;
        const randomMin = button.dataset.randomMin;
        const randomMax = button.dataset.randomMax;

        if (action === "random") {
            let min = 1;
            let max = 100;
            if (randomMin) min = parseInt(randomMin, 10);
            if (randomMax) max = parseInt(randomMax, 10);
            const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
            return `[Button Clicked [ID: ${id}] : RAND = ${randomValue}]`;
        }

        if (action === "random2") {
            let min = 1;
            let max = 100;
            if (randomMin) min = parseInt(randomMin, 10);
            if (randomMax) max = parseInt(randomMax, 10);
            const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
            const finalValue = (Math.random() < 0.5 ? -1 : 1) * randomValue;
            return `[Button Clicked [ID: ${id}] : RAND = ${finalValue}]`;
        }

        if (action === "select-option" && value) {
            return `[Button Clicked [ID: ${id}] : ${value}]`;
        }

        return button.textContent?.trim() || "Button Clicked";
    }

    function getRequiredInputMessage(field: HTMLInputElement) {
        return field.dataset.requiredMessage || field.placeholder || "필수 입력값을 먼저 입력해주세요.";
    }

    function getRequiredChoiceMessage(button: HTMLElement) {
        return button.dataset.requiredMessage || "필수 선택 항목을 먼저 선택해주세요.";
    }

    function validateGroup(groupEl: InteractiveGroupElement) {
        const groupId = getGroupId(groupEl);
        const state = getState(groupId);

        const requiredInputs = Array.from(
            getAllElementsWithinGroup<HTMLInputElement>(
                groupEl,
                ".game-input[data-required='true']",
            ),
        );
        for (const field of requiredInputs) {
            if (!field.value.trim()) {
                return getRequiredInputMessage(field);
            }
        }

        const requiredStateChoices = Array.from(
            getAllElementsWithinGroup<HTMLElement>(
                groupEl,
                ".game-choice[data-role='state-choice'][data-required='true']",
            ),
        );
        const requiredIds = new Set<string>();
        for (const btn of requiredStateChoices) {
            const id = btn.dataset.id;
            if (id) requiredIds.add(id);
        }

        for (const id of requiredIds) {
            if (!state.has(id)) {
                const reference = groupEl.querySelector(
                    `.game-choice[data-role='state-choice'][data-id='${id}']`,
                ) as HTMLElement | null;
                return reference
                    ? getRequiredChoiceMessage(reference)
                    : "필수 선택 항목을 먼저 선택해주세요.";
            }
        }

        return null;
    }

    function markStateChoiceSelected(
        groupEl: InteractiveGroupElement,
        clickedButton: HTMLElement,
    ) {
        const choiceId = clickedButton.dataset.id;
        if (!choiceId) return;

        groupEl
            .querySelectorAll(`.game-choice[data-role='state-choice'][data-id='${choiceId}']`)
            .forEach((el) => {
                el.classList.remove("selected");
                el.setAttribute("aria-pressed", "false");
            });

        clickedButton.classList.add("selected");
        clickedButton.setAttribute("aria-pressed", "true");
    }

    async function appendSpecialAnalysisPrompts(
        queue: string[],
        allInputFields: NodeListOf<HTMLInputElement>,
    ) {
        let birthDate: Date | null = null;
        let birthHour: number | null = null;
        let birthMinute: number | null = null;
        let gender: "남" | "여" = "남";
        let sajuPushed = false;

        const setSaju = (fieldId: string, field: HTMLInputElement) => {
            if (fieldId === "saju_date") {
                birthDate = parseBirthDate(field.value) ?? birthDate;
            }

            if (fieldId === "saju_time") {
                const t = parseBirthTime(field.value);
                birthHour = t.h;
                birthMinute = t.m;
            }

            if (fieldId === "saju_gender") {
                gender = parseGender(field.value);
            }

            if (
                !sajuPushed &&
                birthDate &&
                birthHour !== null &&
                birthMinute !== null
            ) {
                let prompt = "";
                try {
                    prompt = generateSajuAnalysisPrompt(
                        birthDate,
                        birthHour,
                        birthMinute,
                        gender,
                    );
                } catch {
                    prompt = "함수실패";
                }
                queue.push("\n- 만세력\n" + prompt);
                sajuPushed = true;
            }
        };

        allInputFields.forEach((field) => {
            if (field.value.trim() !== "") {
                const fieldId = field.dataset.id || "UNNAMED";
                setSaju(fieldId, field);
            }
        });

        const astroInput = extractAstrologyInput(allInputFields);
        if (astroInput) {
            try {
                const astroPrompt =
                    await generateAstrologyAnalysisPrompt(astroInput);
                queue.push("\n- 서양점성술\n" + astroPrompt);
            } catch {
                queue.push("\n- 서양점성술\n함수실패");
            }
        }
    }

    function markGroupUsed(groupEl: InteractiveGroupElement) {
        groupEl
            .querySelectorAll(
                ".game-choice:not(.used), .game-choice-counter:not(.used), .game-input:not(.used), .game-input-end:not(.used)",
            )
            .forEach((el) => el.classList.add("used"));
        clearValidationMessage(groupEl);
    }

    async function submitGroup(
        groupEl: InteractiveGroupElement,
        options?: { submitPayload?: string },
    ) {
        const groupId = getGroupId(groupEl);
        const state = getState(groupId);
        const validationError = validateGroup(groupEl);
        if (validationError) {
            showValidationMessage(groupEl, validationError);
            return;
        }

        clearValidationMessage(groupEl);

        const payloadLines: string[] = [];
        payloadLines.push(...state.values());
        const allInputFields = getActiveElementsWithinGroup<HTMLInputElement>(
            groupEl,
            ".game-input",
        );

        allInputFields.forEach((field) => {
            if (field.value.trim() !== "") {
                const fieldId = field.dataset.id || "UNNAMED";
                payloadLines.push(`inputField [ID: ${fieldId}]: ${field.value.trim()}`);
            }
        });

        if (options?.submitPayload) {
            payloadLines.push(options.submitPayload);
        }

        await appendSpecialAnalysisPrompts(payloadLines, allInputFields);
        callback("<system-input>" + payloadLines.join("\n") + "</system-input>");
        clearQueue(groupId);
        stateByGroup.delete(groupId);
        markGroupUsed(groupEl);
    }

    const handleClick = async (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const inputEnd = target.closest(".game-input-end:not(.used)") as
            | HTMLElement
            | null;

        if (inputEnd) {
            event.preventDefault();
            await submitGroup(getGroupElement(inputEnd));
            return;
        }

        const choiceButton = target.closest(".game-choice:not(.used)") as
            | HTMLElement
            | null;

        if (!choiceButton) {
            return;
        }

        event.preventDefault();

        const groupEl = getGroupElement(choiceButton);
        const groupId = getGroupId(groupEl);
        const role = choiceButton.dataset.role || "";

        if (role === "state-choice") {
            const id = choiceButton.dataset.id;
            if (!id) return;
            const state = getState(groupId);
            state.set(id, getButtonPayload(choiceButton));
            markStateChoiceSelected(groupEl, choiceButton);
            clearValidationMessage(groupEl);
            return;
        }

        if (role === "submit-action") {
            await submitGroup(groupEl, {
                submitPayload: getButtonPayload(choiceButton),
            });
            return;
        }

        const queue = getQueue(groupId);
        const choiceCounter = getActiveElementWithinGroup<HTMLElement>(
            groupEl,
            ".game-choice-counter",
        );

        let currentPoints = 1;

        if (choiceCounter) {
            const textContent = choiceCounter.textContent || "0";
            const match = textContent.match(/\d+/);
            const originalNumberString = match?.[0] || "1";

            currentPoints = parseInt(originalNumberString, 10);

            if (currentPoints >= 1) {
                currentPoints -= 1;
                choiceCounter.textContent = textContent.replace(
                    originalNumberString,
                    currentPoints.toString(),
                );
            } else {
                console.log("포인트가 부족합니다.");
                return;
            }
        } else {
            currentPoints = 0;
        }

        queue.push(getButtonPayload(choiceButton));

        if (currentPoints !== 0) {
            return;
        }

        const activeEndBtn = getActiveElementWithinGroup<HTMLElement>(
            groupEl,
            ".game-input-end",
        );
        const submitMode = groupEl.dataset.submit || (activeEndBtn ? "manual" : "auto");

        if (submitMode !== "manual" && !activeEndBtn) {
            await submitGroup(groupEl);
        }
    };

    node.addEventListener("click", handleClick);

    return {
        update(nextParams: InteractiveChatParams | ((payload: string) => void)) {
            const nextCallback =
                typeof nextParams === "function"
                    ? nextParams
                    : nextParams.callback;
            const nextResetKey =
                typeof nextParams === "function"
                    ? undefined
                    : nextParams.resetKey;

            callback = nextCallback;
            if (nextResetKey !== resetKey) {
                resetKey = nextResetKey;
                resetInteractiveState();
            }
        },
        destroy() {
            node.removeEventListener("click", handleClick);
        },
    };
}

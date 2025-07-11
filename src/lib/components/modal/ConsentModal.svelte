<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { marked } from "marked";
    import { t } from "svelte-i18n";
    import Icon from "@iconify/svelte";

    export let isOpen: boolean = false;

    const dispatch = createEventDispatcher();

    let expandedSection: 'privacy' | 'terms' | 'chatLogs' | null = null;

    let agreePrivacy: boolean = false;
    let agreeTerms: boolean = false;
    let agreeChatLogs: boolean = false;

    // 모든 필수 동의가 완료되었는지 확인
    $: allAgreed = agreePrivacy && agreeTerms && agreeChatLogs;

    // 전체 동의 체크박스 상태
    $: allCheckboxes = [agreePrivacy, agreeTerms, agreeChatLogs];
    $: isAllChecked = allCheckboxes.every(Boolean);
    $: isIndeterminate = !isAllChecked && allCheckboxes.some(Boolean);

    function toggleAll(checked: boolean) {
        agreePrivacy = checked;
        agreeTerms = checked;
        agreeChatLogs = checked;
    }

    // 동의서 내용 (실제 서비스에서는 백엔드에서 가져오거나 동적으로 로드)
    const privacyPolicyContent = `## Privacy Policy\n\nOur [Site/Service Name] values your personal information and complies with the 「Personal Information Protection Act」 and related laws and regulations. Through this Privacy Policy, we inform you about how the personal information you provide is used and what measures are being taken to protect your personal information.\n\n### 1. Items of Personal Information Collected and Collection Methods\n\nWe may collect the following personal information during member registration, service use, and consultation processes:\n\n*   Required items: Email, password, nickname\n*   Optional items: Profile image, social media ID (when linked)\n\nPersonal information is collected through websites, mobile apps, written forms, phone calls, emails, event applications, etc.\n\n### 2. Purpose of Collection and Use of Personal Information\n\nCollected personal information is used only for the following purposes:\n\n*   Fulfillment of contracts for service provision and settlement of fees for service provision\n*   Member management (identity verification, personal identification, prevention of unauthorized use, etc.)\n*   Service improvement and new service development\n*   Marketing and advertising (with consent)\n\n### 3. Retention and Use Period of Personal Information\n\nIn principle, your personal information will be destroyed without delay once the purpose of collection and use of personal information has been achieved. However, if it is necessary to preserve personal information in accordance with the provisions of relevant laws and regulations, it will be stored for the period specified by those laws.\n\n### 4. Procedures and Methods for Destroying Personal Information\n\nAfter the purpose of use is achieved, your personal information is transferred to a separate DB (or a separate document box for paper documents), stored for a certain period in accordance with relevant laws, and then destroyed. Paper documents are shredded or incinerated, and electronic files are deleted using technical methods that prevent their recovery.\n\n### 5. Provision of Personal Information to Third Parties\n\nIn principle, we do not provide your personal information to external parties. However, exceptions are made in the following cases:\n\n*   When users have given prior consent\n*   When required by law, or when investigative agencies request it in accordance with legal procedures and methods for investigation purposes\n\n### 6. Rights of Users and Legal Representatives and How to Exercise Them\n\nUsers can view or modify their registered personal information at any time, and can also request account termination. Rights can be exercised through [contact person\'s email address or inquiry channel].\n\n### 7. Personal Information Protection Officer\n\nWe are responsible for overseeing personal information processing and have designated a Personal Information Protection Officer as follows to handle user complaints and provide remedies related to personal information processing:\n\n*   Name: [Contact Person\'s Name]\n*   Department: [Department Name]\n*   Email: [Email Address]\n\n### 8. Duty to Notify\n\nThis Privacy Policy may be added, deleted, or amended according to changes in government policies or security technologies. We will notify you through website announcements when the content changes.\n\nLast updated: June 7, 2025`;

    const termsOfServiceContent = `## Terms of Service\n\nThese terms and conditions govern the rights, obligations, and responsibilities of the company and members regarding the use of all services provided by [Site/Service Name] (hereinafter referred to as "the Company"), and other necessary matters.\n\n### 1. Effectiveness and Amendment of Terms\n\nThese terms and conditions become effective upon being posted on the service screen or notified to members by other means. The Company may amend these terms and conditions within the scope not violating relevant laws such as the "Act on the Regulation of Terms and Conditions" and the "Act on Promotion of Information and Communications Network Utilization and Information Protection, etc."\n\n### 2. Member\'s Obligations\n\nMembers shall not engage in any of the following acts:\n\n*   Stealing another member\'s ID and password\n*   Interfering with the operation of the Company\'s services\n*   Distributing obscene or vulgar content that violates public morals\n*   Other acts that violate relevant laws and regulations\n\n### 3. Restriction on Service Use\n\nIf a member violates the obligations of these terms and conditions or interferes with the normal operation of the service, the Company may restrict service use or revoke membership.\n\n### 4. Limitation of Liability\n\nIn cases where the Company cannot provide services due to natural disasters or force majeure equivalent thereto, the Company shall be exempt from liability for service provision.\n\nLast updated: June 7, 2025`;

    const chatLogsConsentContent = `## Chat and Log Data Collection and Use Consent Guide\n\nOur [Site/Service Name] may collect and use chat content and service usage log data to improve services and enhance user experience. This guide provides detailed information on data collection and use.\n\n### 1. Data Items Collected\n\nWe may collect the following data during service use:\n\n*   **Chat Data:** All conversation content generated by users, such as text, images, and files within chat rooms.\n*   **Service Usage Logs:** Connection time, IP address, device information, browser type, service usage history (clicks, page movements, etc.).\n*   **System Error Logs:** Service error 발생 시의 기술적 정보\n\n### 2. Purpose of Collection and Use\n\nCollected data is used only for the following purposes:\n\n*   Stable operation and functional improvement of the service (error analysis and resolution).\n*   Responding to user inquiries and resolving disputes.\n*   Preventing and sanctioning inappropriate use (illegal activities, terms violations, etc.).\n*   Providing customized features and recommendations (with consent).\n\n*   Improving service performance and developing new features through statistical analysis.\n\n**Note:** Chat content may be anonymized or de-identified and used for statistical analysis, and will not be disclosed externally in a form that can identify specific individuals.\n\n### 3. Data Retention and Use Period\n\nCollected data is retained until legal obligations are met or the service purpose is achieved, and then destroyed. (e.g., chat history is retained for [6 months] 보관 후 파기, 오류 로그는 [3 months] 보관 후 파기).\n\n### 4. Withdrawal of Consent and Refusal\n\nUsers can withdraw their consent to data collection and use at any time. However, if you do not consent to the collection of data necessary for essential service provision, some service use may be restricted. Consent withdrawal and inquiries can be made through [contact person\'s email address or inquiry channel].\n\nLast updated: June 7, 2025`;

    // 모달 닫기
    function closeModal() {
        isOpen = false;
        dispatch("close");
    }

    // 확인 버튼 클릭 시
    function handleConfirm() {
        if (allAgreed) {
            dispatch("confirm");
            closeModal();
        } else {
            alert("모든 필수 약관에 동의해야 합니다.");
        }
    }

    function toggleSection(section: 'privacy' | 'terms' | 'chatLogs') {
        expandedSection = expandedSection === section ? null : section;
    }
</script>

{#if isOpen}
    <div class="modal-overlay" on:click={closeModal}>
        <div class="modal-content" on:click={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h2>{$t('consentModal.title')}</h2>
                <button class="close-button" on:click={closeModal}>&times;</button>
            </div>

            <div class="consent-sections">
                <div class="section-item">
                    <div class="section-header" on:click={() => toggleSection('privacy')}>
                        <h3>{$t('consentModal.privacyPolicyTab')}</h3>
                        <Icon icon={expandedSection === 'privacy' ? "ic:round-keyboard-arrow-down" : "ic:round-keyboard-arrow-right"} width="24" height="24" />
                    </div>
                    {#if expandedSection === 'privacy'}
                        <div class="section-content">
                            {@html marked(privacyPolicyContent)}
                        </div>
                    {/if}
                    <label class="checkbox-container">
                        <input type="checkbox" bind:checked={agreePrivacy} />
                        <span class="checkmark"></span>
                        {$t('consentModal.agreePrivacy')}
                    </label>
                </div>

                <div class="section-item">
                    <div class="section-header" on:click={() => toggleSection('terms')}>
                        <h3>{$t('consentModal.termsOfServiceTab')}</h3>
                        <Icon icon={expandedSection === 'terms' ? "ic:round-keyboard-arrow-down" : "ic:round-keyboard-arrow-right"} width="24" height="24" />
                    </div>
                    {#if expandedSection === 'terms'}
                        <div class="section-content">
                            {@html marked(termsOfServiceContent)}
                        </div>
                    {/if}
                    <label class="checkbox-container">
                        <input type="checkbox" bind:checked={agreeTerms} />
                        <span class="checkmark"></span>
                        {$t('consentModal.agreeTerms')}
                    </label>
                </div>

                <div class="section-item">
                    <div class="section-header" on:click={() => toggleSection('chatLogs')}>
                        <h3>{$t('consentModal.chatLogsConsentTab')}</h3>
                        <Icon icon={expandedSection === 'chatLogs' ? "ic:round-keyboard-arrow-down" : "ic:round-keyboard-arrow-right"} width="24" height="24" />
                    </div>
                    {#if expandedSection === 'chatLogs'}
                        <div class="section-content">
                            {@html marked(chatLogsConsentContent)}
                        </div>
                    {/if}
                    <label class="checkbox-container">
                        <input type="checkbox" bind:checked={agreeChatLogs} />
                        <span class="checkmark"></span>
                        {$t('consentModal.agreeChatLogs')}
                    </label>
                </div>
            </div>

            <div class="consent-checkboxes all-agree">
                <label class="checkbox-container">
                    <input
                        type="checkbox"
                        bind:checked={isAllChecked}
                        on:change={(e) => toggleAll(e.currentTarget.checked)}
                        class:indeterminate={isIndeterminate}
                    />
                    <span class="checkmark"></span>
                    {$t('consentModal.agreeToAll')}
                </label>
            </div>

            <div class="modal-footer">
                <button
                    class="confirm-button"
                    class:disabled={!allAgreed}
                    on:click={handleConfirm}
                    disabled={!allAgreed}
                >
                    {$t('consentModal.confirmButton')}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.7); /* 배경 오버레이 */
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000; /* 다른 요소 위에 표시 */
        backdrop-filter: blur(5px); /* 뒤에 있는 화면 블러 처리 */
        animation: fadeIn 0.3s ease-out forwards;
    }

    .modal-content {
        background: #1e1e1e; /* 어두운 배경 */
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
        position: relative;
        width: 90%;
        max-width: 700px; /* 최대 너비 제한 */
        color: #e0e0e0; /* 텍스트 색상 */
        box-sizing: border-box;
        animation: slideIn 0.3s ease-out forwards;
        display: flex;
        flex-direction: column;
        max-height: 90vh; /* 모달 최대 높이 */
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #333;
    }

    .modal-header h2 {
        margin: 0;
        font-size: 1.8rem;
        color: #ffffff;
    }

    .close-button {
        background: none;
        border: none;
        font-size: 2rem;
        color: #bdbdbd;
        cursor: pointer;
        transition: color 0.2s ease;
    }

    .close-button:hover {
        color: #ffffff;
    }

    .consent-sections {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }

    .section-item {
        background-color: #2a2a2a;
        border-radius: 8px;
        overflow: hidden;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.8rem 1rem;
        cursor: pointer;
        background-color: #3a3a3a;
        border-bottom: 1px solid #4a4a4a;
    }

    .section-header h3 {
        margin: 0;
        font-size: 1.1rem;
        color: #ffffff;
    }

    .section-header svg {
        color: #bdbdbd;
        transition: transform 0.3s ease;
    }

    .section-item.expanded .section-header svg {
        transform: rotate(90deg);
    }

    .section-content {
        padding: 1rem;
        max-height: 200px; /* 내용 최대 높이 */
        overflow-y: auto;
        line-height: 1.6;
        font-size: 0.95rem;
        color: #ccc;
        background-color: #2a2a2a;
        border-top: 1px solid #4a4a4a;
    }

    .section-content h2, .section-content h3 {
        color: #ffffff;
        margin-top: 1.5rem;
        margin-bottom: 0.8rem;
    }

    .section-content ul {
        list-style-type: disc;
        margin-left: 20px;
    }

    .section-content li {
        margin-bottom: 0.5rem;
    }

    /* 스크롤바 스타일링 */
    .section-content::-webkit-scrollbar {
        width: 8px;
    }

    .section-content::-webkit-scrollbar-thumb {
        background-color: #4a90e2;
        border-radius: 4px;
    }

    .section-content::-webkit-scrollbar-track {
        background-color: transparent;
    }

    .consent-checkboxes {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #333;
    }

    .consent-checkboxes.all-agree {
        border-top: none;
        padding-top: 0;
        margin-top: 0;
        margin-bottom: 1.5rem;
    }

    .checkbox-container {
        display: flex;
        align-items: center;
        cursor: pointer;
        font-size: 1rem;
        color: #e0e0e0;
        position: relative;
        padding-left: 28px; /* 커스텀 체크박스 공간 */
    }

    .checkbox-container input[type="checkbox"] {
        position: absolute;
        opacity: 0;
        cursor: pointer;
        height: 0;
        width: 0;
    }

    .checkmark {
        position: absolute;
        top: 0;
        left: 0;
        height: 20px;
        width: 20px;
        background-color: #4a4a4a;
        border-radius: 4px;
        transition: background-color 0.2s ease;
    }

    .checkbox-container:hover input ~ .checkmark {
        background-color: #5e5e5e;
    }

    .checkbox-container input:checked ~ .checkmark {
        background-color: #4a90e2;
    }

    .checkmark:after {
        content: "";
        position: absolute;
        display: none;
    }

    .checkbox-container input:checked ~ .checkmark:after {
        display: block;
    }

    .checkbox-container .checkmark:after {
        left: 7px;
        top: 3px;
        width: 6px;
        height: 12px;
        border: solid white;
        border-width: 0 3px 3px 0;
        transform: rotate(45deg);
    }

    /* 불확실 상태 (indeterminate) 스타일 */
    .checkbox-container input.indeterminate ~ .checkmark {
        background-color: #4a90e2; /* 체크된 것과 동일 */
    }

    .checkbox-container input.indeterminate ~ .checkmark:after {
        content: "";
        position: absolute;
        display: block;
        left: 5px;
        top: 9px;
        width: 10px;
        height: 2px;
        background: white;
        transform: none;
        border: none;
    }

    .modal-footer {
        margin-top: 2rem;
        text-align: center;
    }

    .confirm-button {
        background-color: #4a90e2;
        color: white;
        border: none;
        padding: 0.8rem 2rem;
        border-radius: 8px;
        font-size: 1.1rem;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    .confirm-button:hover:not(.disabled) {
        background-color: #357abd;
    }

    .confirm-button.disabled {
        background-color: #666;
        cursor: not-allowed;
        opacity: 0.7;
    }

    /* 애니메이션 */
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes slideIn {
        from { transform: translateY(-50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    /* 반응형 */
    @media (max-width: 768px) {
        .modal-content {
            padding: 1.5rem;
            width: 95%;
        }
        .modal-header h2 {
            font-size: 1.5rem;
        }
        .tab-navigation button {
            font-size: 0.9rem;
            padding: 0.6rem 0.8rem;
        }
        .tab-content-wrapper {
            font-size: 0.9rem;
        }
        .confirm-button {
            padding: 0.7rem 1.5rem;
            font-size: 1rem;
        }
    }
</style>
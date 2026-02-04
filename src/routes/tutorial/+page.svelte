<script>
    import { t } from "svelte-i18n";
</script>

<div class="tutorial-container">
    <h1>{$t("tutorial.title")}</h1>
    <p>{$t("tutorial.description")}</p>

    <div class="notion-iframe-wrapper">
        <iframe
            src="https://wind-chance-11f.notion.site/personaxi-com-228d058c022e80a1ae4ddf99878f5fbc?source=copy_link"
            class="notion-iframe"
            title={$t("tutorial.iframeTitle")}
            frameborder="0"
        ></iframe>
    </div>
</div>

<style>
    .tutorial-container {
        padding: 2rem;
        text-align: center;
        /* 페이지 전체적인 레이아웃 설정 */
    }

    h1 {
        margin-bottom: 1rem;
    }

    .notion-iframe-wrapper {
        width: 100%;
        /* ★★★ 높이를 여기서 조절하세요. 화면 높이의 80%를 차지하게 설정 ★★★ */
        height: 80vh;

        margin-top: 2rem;
        border: 1px solid #333; /* 테두리 스타일 */
        border-radius: 8px; /* 모서리를 둥글게 */
        overflow: hidden; /* 내부 콘텐츠가 삐져나오지 않게 함 */
    }

    .notion-iframe {
        width: 100%;
        height: 100%;
        border: none; /* iframe 자체의 테두리는 완전히 제거 */
    }
</style>

<script>
    // 오픈소스 라이브러리 라이선스 (예시)
    const openSourceLicenses = [
        {
            name: "Svelte",
            license: "MIT License",
            url: "https://svelte.dev/license",
        },
        {
            name: "Three.js",
            license: "MIT License",
            url: "https://github.com/mrdoob/three.js/blob/master/LICENSE",
        },
        {
            name: "Vite",
            license: "MIT License",
            url: "https://github.com/vitejs/vite/blob/main/LICENSE",
        },
        // 사용하는 모든 오픈소스 라이브러리 추가
    ];

    // VRM 모델 라이선스 정보 (네가 제공한 정보 예시를 바탕으로)
    const vrmModels = [
        {
            name: "'탐험가 제미니' 모델",
            creator: "AI Dev Team",
            sourceUrl: "https://[모델_다운로드_혹은_구매_페이지_링크]",
            licenseType:
                "Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)",
            licenseUrl:
                "https://creativecommons.org/licenses/by-sa/4.0/deed.ko",
            permissions: [],
            restrictions: [
                "✔ 수정 시 원본 라이선스와 동일한 조건으로 배포해야 합니다.",
            ],
        },
        // 다른 VRM 모델 정보도 동일하게 추가
    ];
</script>

<svelte:head>
    <title>라이선스 및 크레딧 - [사이트/서비스 이름]</title>
</svelte:head>

<div class="licenses-container">
    <h1>라이선스 및 크레딧</h1>
    <p>
        저희 [사이트/서비스 이름]은(는) 다양한 오픈소스 라이브러리와 VRM 모델을
        활용하여 서비스를 제공하고 있습니다. 아래에서 사용된 리소스들의 라이선스
        정보를 확인하실 수 있습니다.
    </p>

    <hr />

    <h2>1. 오픈소스 라이브러리 라이선스</h2>
    <ul>
        {#each openSourceLicenses as item}
            <li>
                <strong>{item.name}:</strong>
                {item.license} (<a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer">라이선스 전문</a
                >)
            </li>
        {/each}
    </ul>

    <hr />

    <h2>2. VRM 모델 사용 안내</h2>
    <p>
        저희 사이트에서 사용되는 VRM 모델들의 라이선스 정보입니다. 각 모델은
        제작자의 명시된 라이선스 약관에 따라 사용되고 있습니다.
    </p>

    {#each vrmModels as model}
        <div class="vrm-model-card">
            <h3>{model.name}</h3>
            <ul>
                <li>
                    <strong>모델 제작자:</strong>
                    {#if model.creatorUrl}
                        <a
                            href={model.creatorUrl}
                            target="_blank"
                            rel="noopener noreferrer">{model.creator}</a
                        >
                    {:else}
                        {model.creator}
                    {/if}
                </li>
                <li>
                    <strong>모델 출처:</strong>
                    <a
                        href={model.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        >{model.sourceUrl.split("/")[2]}</a
                    >
                </li>
                <li>
                    <strong>사용된 라이선스:</strong>
                    {model.licenseType}
                    {#if model.licenseUrl}
                        (<a
                            href={model.licenseUrl}
                            target="_blank"
                            rel="noopener noreferrer">라이선스 전문</a
                        >)
                    {/if}
                </li>
                {#if model.permissions.length > 0}
                    <li>
                        <strong>주요 허용 사항:</strong>
                        <ul>
                            {#each model.permissions as perm}
                                <li>{@html perm}</li>
                            {/each}
                        </ul>
                    </li>
                {/if}
                {#if model.restrictions.length > 0}
                    <li>
                        <strong>주요 제한 사항:</strong>
                        <ul>
                            {#each model.restrictions as restrict}
                                <li>{@html restrict}</li>
                            {/each}
                        </ul>
                    </li>
                {/if}
            </ul>
        </div>
    {/each}

    <hr />
    <p>
        <small
            >본 정보는 각 리소스의 라이선스 약관을 바탕으로 작성되었으며, 사용
            전에 해당 라이선스의 전문을 반드시 확인하시길 권장합니다.</small
        >
    </p>
</div>

<style>
    .licenses-container {
        max-width: 800px;
        margin: 40px auto;
        padding: 20px;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        line-height: 1.8;
        color: #333;
    }
    h1 {
        color: #2c3e50;
        font-size: 2.5em;
        margin-bottom: 20px;
        text-align: center;
    }
    h2 {
        color: #2c3e50;
        font-size: 2em;
        margin-top: 30px;
        margin-bottom: 15px;
        border-bottom: 2px solid #eee;
        padding-bottom: 5px;
    }
    h3 {
        color: #34495e;
        font-size: 1.5em;
        margin-top: 25px;
        margin-bottom: 10px;
    }
    p,
    ul {
        margin-bottom: 15px;
    }
    ul {
        list-style-type: disc;
        margin-left: 20px;
    }
    ul ul {
        list-style-type: circle;
        margin-left: 20px;
    }
    .vrm-model-card {
        border: 1px solid #eee;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        background-color: #f9f9f9;
    }
    a {
        color: #007bff;
        text-decoration: none;
    }
    a:hover {
        text-decoration: underline;
    }
    hr {
        border: 0;
        height: 1px;
        background: #eee;
        margin: 30px 0;
    }
</style>

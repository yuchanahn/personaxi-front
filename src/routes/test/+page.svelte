<script lang="ts">
    import { onMount } from "svelte";
    import { supabase } from "$lib/supabase";
    // 수파베이스에서 타입 가져오기
    import type { Session, Provider } from "@supabase/supabase-js";

    import { API_BASE_URL } from "$lib/constants";

    // 타입 명시
    let session: Session | null = null;
    let accessToken: string = "";
    let apiResult: string = "";

    onMount(() => {
        // 1. 페이지 로드 시 현재 로그인 상태 확인
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
        });

        // 2. 로그인/로그아웃 상태 변경 감지
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s);
        });

        return () => subscription.unsubscribe();
    });

    // 세션 설정 함수 (타입: Session | null)
    function setSession(s: Session | null) {
        session = s;
        accessToken = s?.access_token || "";

        if (session) {
            console.log("로그인 성공! 유저 정보:", session.user);
            console.log("액세스 토큰:", accessToken);
        }
    }

    // 소셜 로그인 함수 (provider 타입을 Provider로 지정)
    const signInWithSocial = async (provider: Provider) => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                // 개발 중일 땐 localhost, 배포하면 실제 도메인
                redirectTo: `${window.location.origin}/test`,
            },
        });
        if (error) alert(error.message);
    };

    // 로그아웃 함수
    const signOut = async () => {
        await supabase.auth.signOut();
        alert("로그아웃 되었습니다.");
    };

    // 토큰 복사 함수
    const copyToken = () => {
        navigator.clipboard.writeText(accessToken);
        alert(
            "토큰이 복사되었습니다! JWT.io 에서 뜯어보거나 백엔드 요청에 써보세요.",
        );
    };

    // API 테스트 함수
    const testApi = async () => {
        if (!accessToken) {
            alert("로그인이 필요합니다.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/user/me`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            const data = await res.json();
            apiResult = JSON.stringify(data, null, 2);
        } catch (e) {
            apiResult = "Error: " + e;
        }
    };
</script>

<main style="padding: 2rem; max-width: 800px; margin: 0 auto;">
    <h1>🧪 Supabase Auth 테스트</h1>

    {#if !session}
        <div style="display: flex; gap: 10px; flex-direction: column;">
            <p>로그인이 필요합니다.</p>
            <button
                on:click={() => signInWithSocial("google")}
                style="padding: 10px; background: #4285F4; color: white; border: none; cursor: pointer;"
            >
                🔵 Google 로그인
            </button>
            <button
                on:click={() => signInWithSocial("kakao")}
                style="padding: 10px; background: #FEE500; color: black; border: none; cursor: pointer;"
            >
                🟡 Kakao 로그인
            </button>
        </div>
    {:else}
        <!-- color: #333 추가하여 흰색 배경에서 글씨 잘 보이게 수정 -->
        <div
            style="background: #f4f4f4; color: #333; padding: 20px; border-radius: 8px;"
        >
            <h2 style="color: green;">✅ 로그인 성공!</h2>
            <p><strong>Email:</strong> {session.user.email}</p>
            <p><strong>User ID (UUID):</strong> {session.user.id}</p>

            <hr style="border-color: #ccc;" />

            <h3>🔑 Access Token (백엔드에 보낼 것)</h3>
            <textarea
                readonly
                style="width: 100%; height: 100px; font-family: monospace; padding: 10px; border: 1px solid #ccc; border-radius: 4px;"
                >{accessToken}</textarea
            >
            <br />
            <button
                on:click={copyToken}
                style="margin-top: 10px; padding: 5px 10px; cursor: pointer;"
                >📋 토큰 복사하기</button
            >

            <hr style="border-color: #ccc;" />

            <h3>📡 API 테스트 (/api/user/me)</h3>
            <button
                on:click={testApi}
                style="padding: 10px 20px; background: #6c5ce7; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;"
            >
                🚀 내 정보 가져오기 요청
            </button>

            {#if apiResult}
                <div
                    style="margin-top: 20px; background: #2d3436; color: #dfe6e9; padding: 15px; border-radius: 8px; overflow-x: auto;"
                >
                    <pre>{apiResult}</pre>
                </div>
            {/if}

            <hr style="border-color: #ccc; margin-top: 20px;" />

            <button
                on:click={signOut}
                style="background: #ff4444; color: white; border: none; padding: 10px; cursor: pointer; border-radius: 4px;"
            >
                로그아웃
            </button>
        </div>
    {/if}
</main>

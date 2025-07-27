import { goto } from "$app/navigation";
import { chatSessions } from "$lib/stores/chatSessions";
import { is_login } from "$lib/stores/user";
import { API_BASE_URL } from "$lib/constants";
import { t as $t, locale as $locale, locale } from "svelte-i18n";
import { get } from "svelte/store";


// 기본 URL을 동적으로 결정하는 함수
function getBaseUrl(): string {
  // 현재 호스트를 확인
  const host = window.location.hostname;

  if (host === 'localhost' || host === '127.0.0.1') {
    // 로컬 개발 환경
    return 'http://localhost:5173/';
  } else {
    // GitHub Pages 환경 (또는 기타 배포 환경)
    return 'https://personaxi.com/';
  }
}

export async function loginWithAuthKey(authKey: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login?auth_key=${authKey}`, {
    credentials: 'include'
  });
  if (res.ok) {
    window.location.href = getBaseUrl();
  }
}

export async function ownloginWithEmailPass(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/ownlogin`, {
    method: "POST", // ❗ POST 메소드로 지정
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (res.ok) {
    //window.location.href = getBaseUrl();
  } else {
    const errorResponse = await res.json();
    throw new Error(errorResponse.Error || "로그인에 실패했습니다.");
  }
}


export async function getCurrentUser(): Promise<any | null> {
  const res = await fetch(`${API_BASE_URL}/api/user/me`, {
    credentials: 'include'
  });

  if (res.ok == false) {
    return null
  }

  const user = await res.json();

  if (user.data) {
    if (user.data.language != null && user.data.language != "") {
      locale.set(user.data.language);
    } else {
      user.data.language = get(locale)
      const settingRq: any = {
        name: user.name,
        nickname: user.data.nickname || "",
        language: get(locale) || "en",
      };

      try {
        const res = await fetch(`${API_BASE_URL}/api/user/edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingRq),
          credentials: "include",
        });

        if (res.ok) {
        } else {
          const errorText = await res.text();
          alert(errorText);
        }
      } catch (err) {
        console.log(err);
      }
    }
  } else {
    console.log("No user data found");
  }

  return res.ok ? user : null;
}

export async function confirmConsent(): Promise<any | null> {
  const res = await fetch(`${API_BASE_URL}/api/user/consent`, {
    credentials: 'include'
  });

  if (res.ok == false) {
    return null
  }

  const user = await res.json();

  return res.ok ? user : null;
}

export async function logout() {
  const res = await fetch(`${API_BASE_URL}/api/logout`, {
    credentials: 'include'
  });

  goto("/")

  chatSessions.set([]);
  is_login.set(false);
}
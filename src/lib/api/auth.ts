import { goto } from "$app/navigation";
import { chatSessions } from "$lib/stores/chatSessions";
import { is_login } from "$lib/stores/user";
import { API_BASE_URL } from "$lib/constants";
import { t as $t, locale as $locale, locale } from "svelte-i18n";


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

export async function getCurrentUser(): Promise<any | null> {
  const res = await fetch(`${API_BASE_URL}/api/user/me`, {
    credentials: 'include'
  });

  if (res.ok == false) {
    return null
  }

  const user = await res.json();

  if (user.data) {
    console.log(" # USER DATA SET LOCALE");
    if (user.data.language != null && user.data.language != "") {
      locale.set(user.data.language);
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
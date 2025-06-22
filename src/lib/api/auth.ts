import { goto } from "$app/navigation";
import { chatSessions } from "$lib/stores/chatSessions";
import { is_login } from "$lib/stores/user";
import { API_BASE_URL } from "$lib/constants";


// 기본 URL을 동적으로 결정하는 함수
function getBaseUrl(): string {
  // 현재 호스트를 확인
  const host = window.location.hostname;

  if (host === 'localhost' || host === '127.0.0.1') {
    // 로컬 개발 환경
    return 'http://localhost:5173/personaxi-front/';
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

export async function getCurrentUser(): Promise<{ Name: string; Email: string } | null> {
  const res = await fetch(`${API_BASE_URL}/api/user/me`, {
    credentials: 'include'
  });

  if (res.ok == false) {
    return null
  }

  return res.ok ? await res.json() : null;
}

export async function logout() {
  const res = await fetch(`${API_BASE_URL}/api/logout`, {
    credentials: 'include'
  });

  goto("/")

  chatSessions.set([]);
  is_login.set(false);
}
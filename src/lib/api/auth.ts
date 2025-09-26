import { goto } from "$app/navigation";
import { chatSessions } from "$lib/stores/chatSessions";
import { api } from "$lib/api";
import { t as $t, locale as $locale, locale } from "svelte-i18n";
import { get } from "svelte/store";
import { accessToken } from "$lib/stores/auth";
import { st_user } from "$lib/stores/user";


export function getBaseUrl(): string {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:5173/';
  } else {
    return 'https://personaxi.com/';
  }
}


export async function ownloginWithEmailPass(email: string, password: string): Promise<void> {
  const res = await api.post2(`/api/auth/ownlogin`, { email, password });

  if (res.ok) {
    //window.location.href = getBaseUrl();
    goto("/hub")
    const data = await res.json();
    accessToken.set(data.access_token);
  } else {
    const errorResponse = await res.json();
    throw new Error(errorResponse.error || "로그인에 실패했습니다.");
  }
}


export async function getCurrentUser(): Promise<any | null> {
  const res = await api.get(`/api/user/me`);

  if (res.ok == false) {
    return null
  }

  const user = await res.json();

  if (res.ok) {
    st_user.set(user);
  }

  return res.ok ? user : null;
}

export async function confirmConsent(): Promise<any | null> {
  const res = await api.get(`/api/user/consent`);

  if (res.ok == false) {
    return null
  }

  const user = await res.json();

  return res.ok ? user : null;
}

export async function logout() {
  const res = await api.get(`/api/logout`);

  goto("/")

  chatSessions.set([]);
}
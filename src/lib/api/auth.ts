import { goto } from "$app/navigation";
import { chatSessions } from "$lib/stores/chatSessions";
import { api } from "$lib/api";
import { t as $t, locale as $locale, locale } from "svelte-i18n";
import { get } from "svelte/store";
import { accessToken } from "$lib/stores/auth";


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
    throw new Error(errorResponse.Error || "로그인에 실패했습니다.");
  }
}


export async function getCurrentUser(): Promise<any | null> {
  const res = await api.get(`/api/user/me`);

  if (res.ok == false) {
    return null
  }

  const user = await res.json();

  //if (user.data) {
  //  if (user.data.language != null && user.data.language != "") {
  //
  //
  //    
  //    locale.set(user.data.language);
  //
  //
  //
  //  } else {
  //    user.data.language = get(locale)
  //    const settingRq: any = {
  //      name: user.name,
  //      nickname: user.data.nickname || "",
  //      language: get(locale) || "en",
  //    };
  //
  //    try {
  //      const res = await api.post(`/api/user/edit`, settingRq);
  //
  //      if (res.ok) {
  //      } else {
  //        const errorText = await res.text();
  //        alert(errorText);
  //      }
  //    } catch (err) {
  //      console.log(err);
  //    }
  //  }
  //} else {
  //  console.log("No user data found");
  //}

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
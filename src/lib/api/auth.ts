import { goto } from "$app/navigation";
import { chatSessions } from "$lib/stores/chatSessions";
import { is_login } from "$lib/stores/user";

export async function loginWithAuthKey(authKey: string): Promise<void> {
  const res = await fetch(`http://localhost:8080/api/auth/login?auth_key=${authKey}`, {
    credentials: 'include'
  });
  if (res.ok) {
    window.location.href = "http://localhost:5173/personaxi-front/";
  }
}

export async function getCurrentUser(): Promise<{ Name: string; Email: string } | null> {
  const res = await fetch("http://localhost:8080/api/user/me", {
    credentials: 'include'
  });

  if (res.ok == false) {
    return null
  }

  return res.ok ? await res.json() : null;
}

export async function logout() {
  const res = await fetch("http://localhost:8080/api/logout", {
    credentials: 'include'
  });

  goto("/personaxi-front/")

  chatSessions.set([]);
  is_login.set(false);
}
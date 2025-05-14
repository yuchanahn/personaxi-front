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
  return res.ok ? await res.json() : null;
}

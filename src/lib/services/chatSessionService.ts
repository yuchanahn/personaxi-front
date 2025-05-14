import { chatSessions } from '$lib/stores/chatSessions';

export const createNewSession = (id: string, name: string) => {
  const newSession = {
    id,
    name,
    createdAt: new Date().toISOString()
  };
  chatSessions.update((sessions) => {
    const exists = sessions.some((s) => s.id === id);
    return exists ? sessions : [...sessions, newSession];
  });
};

export const deleteSession = (id: string) => {
  chatSessions.update((sessions) => sessions.filter((s) => s.id !== id));
};
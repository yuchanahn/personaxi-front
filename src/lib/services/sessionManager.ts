import { goto } from '$app/navigation';
import { getSessionById, ChatSessionType } from '$lib/stores/chatSessions';

export function handleSelect(id: string) {
    const session = getSessionById(id);
    if (session) {
        switch (session.type) {
            case ChatSessionType.CHAT:
                goto(`/personaxi-front/chat?c=${id}`);
                break;
            case ChatSessionType.CHARACTER:
                goto(`/personaxi-front/2d?c=${id}`);
                break;
            case ChatSessionType.CHARACTER3D:
                goto(`/personaxi-front/character?c=${id}`);
                break;
            case ChatSessionType.SYSTEM:
                switch (session.id) {
                    case "2": goto(`/personaxi-front/hub`); break;
                    case "3": goto(`/personaxi-front/user/setting`); break;
                    case "4": goto(`/personaxi-front/user/persona`); break;
                    case "5": goto(`/personaxi-front/edit`); break;
                    case "1": goto(`/personaxi-front/chat`);
                }
                break;
            default:
                console.error('Unknown session type:', session.type);
                break;
        }
    } else {
        console.error('Session not found:', id);
    }

}

export function handleDelete(id: string) {
    console.log('Deleted session:', id);
}
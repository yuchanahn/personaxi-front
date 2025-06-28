import { goto } from '$app/navigation';
import { getSessionById, ChatSessionType } from '$lib/stores/chatSessions';

export function handleSelect(id: string) {
    const session = getSessionById(id);
    if (session) {
        switch (session.type) {
            case ChatSessionType.CHAT:
                goto(`/chat?c=${id}`);
                break;
            case ChatSessionType.CHARACTER:
                goto(`/2d?c=${id}`);
                break;
            case ChatSessionType.CHARACTER3D:
                goto(`/character?c=${id}`);
                break;
            case ChatSessionType.SYSTEM:
                switch (session.id) {
                    case "2": goto(`/hub`); break;
                    case "3": goto(`/user/setting`); break;
                    case "4": goto(`/user/persona`); break;
                    case "5": goto(`/edit`); break;
                    case "100": goto(`/legal`);
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
// AnimationHelpers.ts
import * as THREE from 'three';

// stripRootMotion.ts
import { AnimationClip, VectorKeyframeTrack } from 'three';

export function playOnce(
    mixer: THREE.AnimationMixer,
    action: THREE.AnimationAction,
    fadeIn = 0.2,
    onFinished?: () => void
) {
    action
        .reset()
        .setLoop(THREE.LoopOnce, 0)
        .fadeIn(fadeIn)
        .play();
    action.clampWhenFinished = true;      // 마지막 포즈 유지

    const handler = (e: any) => {
        if (e.action === action) {
            mixer.removeEventListener('finished', handler);
            onFinished?.();
        }
    };
    mixer.addEventListener('finished', handler);
}

export function fadeToLoop(
    mixer: THREE.AnimationMixer,
    onceAction: THREE.AnimationAction,
    loopAction: THREE.AnimationAction,
    crossFade = 0.3
) {
    playOnce(mixer, onceAction, 0.2, () => {
        // onceAction 끝나면 루프 애니로 크로스페이드
        loopAction
            .reset()
            .setLoop(THREE.LoopRepeat, Infinity)
            .fadeIn(crossFade)
            .play();
        onceAction.fadeOut(crossFade);
    });
}


/**
 * Removes root‑bone position tracks (X / Z translation) so the clip plays “in‑place”.
 * @param clips      single AnimationClip or array
 * @param rootNames  names of root/hips bones to strip (edit as needed)
 * @returns          same clips, mutated in‑place and returned for convenience
 */
export function stripRootMotion(
    clips: AnimationClip | AnimationClip[],
    rootNames: string[] = ['Hips', 'hips', 'Root', 'mixamorigHips']
): AnimationClip[] {
    const list = Array.isArray(clips) ? clips : [clips];

    for (const clip of list) {
        clip.tracks = clip.tracks.filter((track) => {
            if (!(track instanceof VectorKeyframeTrack)) return true;        // keep non‑vector tracks
            const [bone, prop] = track.name.split('.');
            const isRoot = rootNames.includes(bone);
            return !(isRoot && prop === 'position');                         // drop root.position
        });
        clip.resetDuration();                                              // recalc duration
    }

    return list;
}

import * as THREE from 'three'

export function serializeClip(clip: THREE.AnimationClip): object {
    return {
        name: clip.name,
        duration: clip.duration,
        tracks: clip.tracks.map((track) => {
            return {
                name: track.name,
                type: track.ValueTypeName,
                times: Array.from(track.times),
                values: Array.from(track.values),
            }
        }),
    }
}

export function deserializeClip(data: any): THREE.AnimationClip {
    const tracks = data.tracks.map((trackData: any) => {
        switch (trackData.type) {
            case 'quaternion':
            case 'quaternionvec4':
                return new THREE.QuaternionKeyframeTrack(
                    trackData.name,
                    Float32Array.from(trackData.times),
                    Float32Array.from(trackData.values)
                )
            case 'vector':
            case 'vector3':
                return new THREE.VectorKeyframeTrack(
                    trackData.name,
                    Float32Array.from(trackData.times),
                    Float32Array.from(trackData.values)
                )
            default:
                console.warn('Unknown track type:', trackData.type)
                return null
        }
    }).filter(Boolean)

    return new THREE.AnimationClip(data.name, data.duration, tracks)
}

export async function saveClipAsJSON(clip: THREE.AnimationClip, fileName: string) {
    return;

    const json = serializeClip(clip)
    const blob = new Blob([], { type: 'application/json' })

    // 2. 전송
    const response = await fetch('http://localhost:3000/anim/anim', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: fileName, file: json }),
    })

    if (!response.ok) {
        console.error("anim.sendFailed", response.statusText)
    } else {
        console.log("anim.sendSuccess")
    }
}
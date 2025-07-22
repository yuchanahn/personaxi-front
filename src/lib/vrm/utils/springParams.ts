import * as THREE from 'three/webgpu';

export function springPos(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    target: THREE.Vector3,
    halflife: number,  // 👉 튜닝은 여기서만
    dt: number
) {
    if (halflife <= 0) return;           // 위치 스프링 끄기

    const y = 2 * Math.log(2) / halflife;   // critical damping
    const j0 = pos.clone().sub(target);     // x(0)
    const j1 = vel.clone().addScaledVector(j0, y); // x'(0) + y x(0)

    const eydt = Math.exp(-y * dt);
    pos.copy(target)
        .addScaledVector(j0.addScaledVector(j1, dt), eydt);

    vel.copy(j1).sub(j0.multiplyScalar(y)).multiplyScalar(eydt);
}

export function springQuat(
    q: THREE.Quaternion,
    w: THREE.Vector3,
    target: THREE.Quaternion,
    halfLife: number,
    dt: number
) {
    // 0️⃣ 현재 각속도로 한 프레임 회전 적용
    if (w.lengthSq() > 1e-12) {
        const dq = new THREE.Quaternion()
            .setFromAxisAngle(w.clone().normalize(), w.length() * dt);
        q.multiply(dq).normalize();   // ← 먼저 곱한다
    }

    // 1️⃣ 오차 쿼터니언 (여기서 early‑exit 제거)
    const qErr = q.clone().invert().multiply(target).normalize();
    // springQuat 안에서 오차 계산 직후
    if (qErr.w < 0) {   // 반대 헤미스피어면
        qErr.x *= -1;
        qErr.y *= -1;
        qErr.z *= -1;
        qErr.w *= -1;     // ← 180° 넘어가는 회전을 0~180° 로 변환
    }


    // 2️⃣ 축*각 벡터로
    const angle = 2 * Math.acos(THREE.MathUtils.clamp(qErr.w, -1, 1));
    if (angle < 1e-5) { w.set(0, 0, 0); return; }   // 아주 작을 때만 중단

    const axis = new THREE.Vector3(qErr.x, qErr.y, qErr.z).normalize();
    const v = axis.multiplyScalar(angle);

    // 3️⃣ critically‑damped 스프링으로 w 감쇠
    springPos(v, w, new THREE.Vector3(0, 0, 0), halfLife, dt);
}


export function integrateQuatSpring(
    q: THREE.Quaternion,  // 현재
    w: THREE.Vector3,     // 각속도
    q0: THREE.Quaternion, // 목표
    k: number, c: number,
    dt: number
) {
    // 1️⃣ 오차(회전) = q⁻¹ * q0
    const qInv = q.clone().invert();
    const qErr = qInv.multiply(q0);

    // 2️⃣ 오차를 소축*각(angle)로
    const angle = 2 * Math.acos(THREE.MathUtils.clamp(qErr.w, -1, 1));
    const sinHalf = Math.sin(angle * 0.5);
    const axis = sinHalf < 1e-4 ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(qErr.x, qErr.y, qErr.z).divideScalar(sinHalf);

    // 3️⃣ 회전 가속도 = -k*θ - c*ω
    const accel = axis.multiplyScalar(-k * angle).add(w.clone().multiplyScalar(-c));

    // 4️⃣ 속도·쿼터니언 적분
    w.addScaledVector(accel, dt);
    const dq = new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), w.length() * dt);
    q.multiply(dq).normalize();
}

export function isSettledPos(st: any) {
    if (st.halfPos === 0) return true;

    return st.velPos.lengthSq() < 1e-6 &&
        st.bone.position.distanceToSquared(st.originalPos) < 1e-4; // 10배 느슨
}

export function isSettledRot(st: any) {
    const dot = Math.abs(st.bone.quaternion.dot(st.originalQuat));
    const angleSq = 2 * (1 - dot);        // 소각 근사
    return st.velRot.lengthSq() < 1e-4 &&
        angleSq < 1e-4;                // ≈ 0.01 rad ≒ 0.6°
}

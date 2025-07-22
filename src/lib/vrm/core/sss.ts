update(dt: number) {
    /* …기타 로직 생략… */

    // --- Hit reaction 스프링 ---------------------------------
    for (let i = this.hitStates.length - 1; i >= 0; --i) {
        const st = this.hitStates[i];

        // 후크 + 감쇠
        const disp = st.bone.position.clone().sub(st.originalPos);
        const accel = disp.multiplyScalar(-st.k)
            .add(st.velPos.clone().multiplyScalar(-st.c));

        st.velPos.addScaledVector(accel, dt);
        st.bone.position.addScaledVector(st.velPos, dt);

        // 종료 조건
        if (disp.lengthSq() < 1e-6 && st.velPos.lengthSq() < 1e-6) {
            st.bone.position.copy(st.originalPos);
            this.hitStates.splice(i, 1);
        }
    }

    /* …나머지 update 로직… */
}

---


// 스프링 상수는 전역 상수 or 파라미터로
const SPRING_K = 60;
const SPRING_C = 12;

hitByMouse(nx: number, ny: number, strength = 1.0) {
    /* …본 탐색 생략… */
    if (!closest) return;

    const vel = ray.direction.clone().multiplyScalar(0.6 * strength);

    this.hitStates.push({
        bone: closest,
        originalPos: closest.position.clone(),
        originalQuat: closest.quaternion.clone(),
        velPos: vel,
        k: SPRING_K * strength, // 개별 본에 저장
        c: SPRING_C
    });
}

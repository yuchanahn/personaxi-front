import * as THREE from 'three/webgpu';
import { Model } from './model';
import { v4 as uuidv4 } from 'uuid';

export class Viewer {
  public model = new Model();

  private renderer: THREE.WebGPURenderer;
  private scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private light: THREE.DirectionalLight;
  private clock = new THREE.Clock();

  private canvas: HTMLCanvasElement;
  private id = uuidv4();

  private animationFrameId: number | null = null; // 애니메이션 프레임 ID를 저장할 변수
  private isStopped = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true }); // alpha: true 추가 (배경 투명도)
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(25, canvas.clientWidth / canvas.clientHeight, 0.01, 100);
    this.camera.position.set(0, 1.35, 2.5); // Z 값을 조금 뒤로 빼서 시작

    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
    ambient.position.set(1, 3, 1);
    this.scene.add(ambient);

    this.light = new THREE.DirectionalLight(0xffffff, 1.0);
    this.light.position.set(1, 2, 1);
    this.scene.add(this.light);
  }

  public getHeadPointInUI(): { x: number, y: number } | null {
    if (!this.model.vrm) {
      console.warn("VRM 모델이 로드되지 않았습니다.");
      return null;
    }

    const headBone = this.model.vrm.humanoid.getBoneNode("head");
    if (!headBone) {
      console.warn("헤드 본을 찾을 수 없습니다.");
      return null;
    }

    // 헤드 본의 월드 좌표를 가져옵니다.
    const headWorldPos = new THREE.Vector3();
    headBone.getWorldPosition(headWorldPos);

    // 카메라를 기준으로 2D 화면 좌표로 변환합니다.
    const projectedPos = headWorldPos.clone().project(this.camera);

    // 화면 안에 있는지 판단
    if (projectedPos.z < 1) {
      const x = (projectedPos.x * 0.5 + 0.5) * this.canvas.clientWidth;
      const y = (projectedPos.y * -0.5 + 0.5) * this.canvas.clientHeight;
      return { x: Math.round(x), y: Math.round(y) };
    }

    return null; // 화면 밖에 있을 경우 null 반환
  }

  async loadModel(url: string) {
    if (this.model.vrm) {
      this.scene.remove(this.model.vrm.scene);
    }

    const vrm = await this.model.load(url, this.camera);
    if (!vrm) {
      console.error("VRM 로딩 실패");
      return null;
    }

    const box = new THREE.Box3().setFromObject(vrm.scene);
    vrm.scene.position.y = -box.min.y;

    vrm.scene.updateMatrixWorld(true);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const cameraHeight = center.y + size.y / 2 * 0.9;
    const distance = size.y * 1.5;

    this.camera.position.set(center.x, cameraHeight, distance);
    this.camera.lookAt(new THREE.Vector3(center.x, cameraHeight, center.z));
    this.camera.updateProjectionMatrix();

    this.model.initAnimations(vrm);
    this.scene.add(vrm.scene);

    if (!this.clock.running) {
      this.start();
    }

    return this.model;
  }

  private renderLoop = async () => {
    if (this.isStopped) {
      console.log("Render loop stopped by flag.");
      return;
    }

    const delta = this.clock.getDelta();

    this.model.update(delta);

    await this.renderer.renderAsync(this.scene, this.camera);

    // 4. 다음 프레임을 요청합니다.
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  private updateUIPosition() {
    if (!this.model?.vrm) return;

    // ★★★ 가장 큰 문제점 수정: .clone()을 제거해야 합니다. ★★★
    const headBone = this.model.vrm.humanoid.getBoneNode("head");

    if (!headBone) {
      // 헤드 본을 못 찾을 경우, 이 프레임에서는 UI 업데이트를 건너뜁니다.
      return;
    }

    console.log("--- UI Update ---");
    const headWorldPos = new THREE.Vector3();
    headBone.getWorldPosition(headWorldPos);
    console.log("Head World Pos:", { x: headWorldPos.x.toFixed(2), y: headWorldPos.y.toFixed(2), z: headWorldPos.z.toFixed(2) });

    const projectedPos = headWorldPos.clone().project(this.camera);
    console.log("Projected (NDC):", { x: projectedPos.x.toFixed(2), y: projectedPos.y.toFixed(2), z: projectedPos.z.toFixed(2) });

    // 화면 안에 있는지 판단
    const isOnScreen = projectedPos.z < 1; // z < 1 만으로도 화면 앞/뒤 판단 충분
    console.log("Is On Screen?", isOnScreen);

    if (isOnScreen) {
      // 이 부분은 말풍선을 실제로 구현할 때 사용하시면 됩니다.
      // const x = (projectedPos.x * 0.5 + 0.5) * this.canvas.clientWidth;
      // const y = (projectedPos.y * -0.5 + 0.5) * this.canvas.clientHeight;
      // console.log("Final Pixel Coords:", { x: Math.round(x), y: Math.round(y) });
    }
  }

  start() {
    this.clock.start();
    this.renderLoop(); // update 대신 renderLoop를 호출
    this.isStopped = false;
  }

  // Viewer 클래스의 stop 함수를 아래 내용으로 교체

  stop() {
    if (this.isStopped) {
      console.log("Viewer is already stopped.");
      return;
    }

    this.isStopped = true;

    console.log("Stopping viewer and releasing resources...");

    // 1. 애니메이션 루프를 최우선으로 중지합니다.
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      // this.animationFrameId = 0; // ID 초기화 (선택 사항)
    }
    this.clock.stop();

    // 2. 씬(Scene)에서 VRM 객체를 제거합니다.
    // vrm.dispose()를 직접 호출하는 대신, 씬 그래프에서만 분리합니다.
    if (this.model && this.model.vrm) {
      this.scene.remove(this.model.vrm.scene);
      console.log("VRM model removed from scene.");
    }

    // 3. 렌더러를 dispose 합니다.
    // WebGPURenderer의 dispose는 연관된 모든 GPU 리소스를 해제해야 합니다.
    // 개별 재질/지오메트리 dispose 호출 시 충돌이 나므로, 렌더러 자체의 dispose에 맡깁니다.
    this.renderer.dispose();
    console.log("Renderer disposed.");

    // 4. 참조를 정리하여 가비지 컬렉터가 메모리를 회수하도록 돕습니다.
    if (this.model) {
      this.model.vrm = null;
    }
    console.log("Viewer stopped successfully.");
  }
}
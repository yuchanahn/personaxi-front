import * as THREE from 'three/webgpu';
import { Model } from './model';
import { v4 as uuidv4 } from 'uuid';

import { PostProcessing, pass } from 'three/tsl';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export class Viewer {
  public model = new Model();

  private renderer: THREE.WebGPURenderer;
  private scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private keyLight: THREE.DirectionalLight;
  private clock = new THREE.Clock();

  private canvas: HTMLCanvasElement;
  private id = uuidv4();

  private animationFrameId: number | null = null; // 애니메이션 프레임 ID를 저장할 변수
  private isStopped = false;
  private renderScale = 1.0;
  private usePostProcessing = false;

  private postProcessing: PostProcessing;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // --- 1. 렌더러 설정 (그림자 추가) ---
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(this.renderScale);
    this.renderer.setClearColor(new THREE.Color(0x000000), 0);
    //this.renderer.shadowMap.enabled = true; // 그림자 활성화
    //this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      25,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.35, 2.5);

    // --- 2. 조명 업그레이드 (3점 조명 + 자연광) ---
    this.scene.remove(...this.scene.children.filter((c) => c instanceof THREE.Light));

    // 자연스러운 환경광(흰색 -> 회색)
    //const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.5);
    //this.scene.add(hemisphereLight);

    // 주 조명 (Key Light, 태양 역할)
    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    this.keyLight.position.set(0.9, 1.9, 0.9);
    //keyLight.castShadow = true;
    //keyLight.shadow.mapSize.set(2048, 2048); // 그림자 해상도
    this.scene.add(this.keyLight);

    // 보조 조명 (Fill Light, 그림자 영역을 부드럽게)
    //const fillLight = new THREE.DirectionalLight(0xffffff, 1.8);
    //fillLight.position.set(-1, 1, 2);
    //this.scene.add(fillLight);
    //
    //// 후광 (Back Light, 캐릭터 윤곽 강조)
    //const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
    //backLight.position.set(-1, 2, -2);
    //this.scene.add(backLight);

    // --- 3. HDRI 환경맵 설정 (사실적인 반사광) ---
    if (false)
      new RGBELoader().load('/studio_small_03_1k.hdr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        //this.scene.background = texture;
        this.scene.environment = texture;
      });

    // --- 4. 후처리 설정 (블룸 효과) ---
    const scenePass = pass(this.scene, this.camera);

    this.postProcessing = new PostProcessing(this.renderer);
    this.postProcessing.outputNode = scenePass;
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

  async loadModel(
    url: string,
    onProgress?: (phase: 'network' | 'decrypt' | 'parse', progress: number) => void,
  ) {
    if (this.model.vrm) {
      this.scene.remove(this.model.vrm.scene);
    }

    const vrm = await this.model.load(url, this.camera, onProgress);
    if (!vrm) {
      console.error("VRM 로딩 실패");
      return null;
    }

    vrm.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });

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

    await this.model.initAnimations();
    this.scene.add(vrm.scene);

    //this.scene.add(new THREE.SkeletonHelper(vrm.scene));


    if (!this.clock.running) {
      this.start();
    }

    return this.model;
  }

  public setRenderScale(scale: number) {
    this.renderScale = 1.0;
    this.renderer.setPixelRatio(this.renderScale);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
  }

  public getRenderScale() {
    return this.renderScale;
  }

  public setUsePostProcessing(enabled: boolean) {
    this.usePostProcessing = enabled;
  }

  public getUsePostProcessing() {
    return this.usePostProcessing;
  }

  public setCameraFov(fov: number) {
    this.camera.fov = Math.max(15, Math.min(fov, 45));
    this.camera.updateProjectionMatrix();
  }

  public setKeyLight(intensity: number, x: number, y: number, z: number) {
    this.keyLight.intensity = Math.max(0, intensity);
    this.keyLight.position.set(x, y, z);
    this.keyLight.updateMatrixWorld();
  }

  public getKeyLightState() {
    return {
      intensity: this.keyLight.intensity,
      x: this.keyLight.position.x,
      y: this.keyLight.position.y,
      z: this.keyLight.position.z,
    };
  }

  private renderLoop = async () => {
    if (this.isStopped) {
      console.log("Render loop stopped by flag.");
      return;
    }

    const delta = this.clock.getDelta();

    this.model.update(delta);

    if (this.usePostProcessing) {
      await this.postProcessing.renderAsync();
    } else {
      await this.renderer.renderAsync(this.scene, this.camera);
    }

    // 4. 다음 프레임을 요청합니다.
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  private updateUIPosition() {
    if (!this.model?.vrm) return;

    const headBone = this.model.vrm.humanoid.getBoneNode("head");

    if (!headBone) {
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
    if (!this.isStopped && (this.animationFrameId !== null || this.clock.running)) {
      return;
    }

    this.isStopped = false;
    this.clock.start();
    this.renderLoop();
  }


  stop() {
    if (this.isStopped) {
      console.log("Viewer is already stopped.");
      return;
    }

    this.isStopped = true;

    console.log("Stopping viewer and releasing resources...");

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = null;
    this.clock.stop();

    if (this.model && this.model.vrm) {
      this.scene.remove(this.model.vrm.scene);
      console.log("VRM model removed from scene.");
    }

    if (this.model) {
      this.model.dispose();
      console.log("VRM model disposed.");
    }

    this.renderer.dispose();
    console.log("Renderer disposed.");

    console.log("Viewer stopped successfully.");
  }
}

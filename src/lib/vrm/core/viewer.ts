import * as THREE from 'three/webgpu';
import { Model } from './model';

export class Viewer {
  private renderer: THREE.WebGPURenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private light: THREE.DirectionalLight;
  private model = new Model();
  private clock = new THREE.Clock();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, canvas.clientWidth / canvas.clientHeight, 0.1, 20);
    this.camera.position.set(0, 1.5, 3);

    this.light = new THREE.DirectionalLight(0xffffff, Math.PI);
    this.light.position.set(1, 2, 1);
    this.scene.add(this.light);

    //this.scene.add(new THREE.GridHelper(10, 10));
    //this.scene.add(new THREE.AxesHelper(5));
  }

  async loadModel(url: string) {
    const vrm = await this.model.load(url);
    if (vrm) { 
      this.model.initAnimations(vrm);
      this.scene.add(vrm.scene);
    }
  }

  update = async () => {
    requestAnimationFrame(this.update);
    const delta = this.clock.getDelta();
    this.model.update(delta);
    await this.renderer.renderAsync(this.scene, this.camera);
  };

  start() {
    this.clock.start();
    this.update();
  }
}

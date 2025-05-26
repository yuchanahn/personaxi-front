import * as THREE from 'three/webgpu';
import { Model } from './model';
import { v4 as uuidv4 } from 'uuid';

export class Viewer {
  public model = new Model();

  private renderer: THREE.WebGPURenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private light: THREE.DirectionalLight;
  private clock = new THREE.Clock();

  private id = uuidv4();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(25, canvas.clientWidth / canvas.clientHeight, 0.1, 5);
    this.camera.position.set(0, 1.35, 1);

    this.light = new THREE.DirectionalLight(0xffffff, 1);
    const ambient = new THREE.AmbientLight(0xffffff, 2.0);
    ambient.position.set(1, 3, 1);
    this.scene.add(ambient);

    this.light.position.set(1, 2, 1);
    this.scene.add(this.light);
  }

  async loadModel(url: string) {
    this.clock.stop();
    const vrm = await this.model.load(url, this.camera);
    if (vrm) {
      this.model.initAnimations(vrm);
      this.scene.add(vrm.scene);
    }
    this.clock.start();

    return this.model;
  }

  update = async () => {
    requestAnimationFrame(this.update);
    const delta = this.clock.getDelta();
    this.model.update(delta);
    await this.renderer.renderAsync(this.scene, this.camera);
    //this.renderer.render(this.scene, this.camera)
  };

  start() {
    this.clock.start();
    this.update();
  }

  stop() {
    this.clock.stop();

    console.log("stop!!");
  }
}

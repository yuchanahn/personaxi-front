import { base } from '$app/paths'
import * as THREE from 'three/webgpu'
import { Model } from './model'
import { loadVrmAnimation } from './animation/load_animation'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export class Viewer {
  public isReady: boolean
  public model?: Model

  private _renderer?: THREE.WebGPURenderer
  private _clock: THREE.Clock
  private _scene: THREE.Scene
  private _camera?: THREE.PerspectiveCamera
  private _cameraControls?: OrbitControls
  private _viewerResizeObserver: ResizeObserver

  constructor() {
    this.isReady = false
    this._scene = new THREE.Scene()

    // lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2)
    directionalLight.position.set(1.0, 1.0, 1.0).normalize()
    this._scene.add(ambientLight)
    this._scene.add(directionalLight)

    this._clock = new THREE.Clock()
    this._clock.start()

    this._viewerResizeObserver = new ResizeObserver(() => {
      this.resize()
    })

    // 바닥 생성
    const floorGeometry = new THREE.PlaneGeometry(7, 7);
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);

    floor.rotation.x = -Math.PI / 2;

    this._scene.add(floor);


    // 마우스 우클릭 이벤트 처리
    window.addEventListener('contextmenu', (event) => { 
      event.preventDefault(); // 기본 우클릭 메뉴 방지

      // 마우스 좌표를 정규화된 디바이스 좌표로 변환 (-1 ~ +1)
      const mouse = new THREE.Vector2()
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Raycaster로 바닥 탐지
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, this._camera || new THREE.PerspectiveCamera());
      const intersects = raycaster.intersectObject(floor);

      if (intersects.length > 0) {
        const point = intersects[0].point; // 교차 지점 가져오기
        console.log('Intersection point:', point);

        // 시각적 확인용 예제: 클릭한 위치에 작은 구 추가
        const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(point);
        this._scene.add(sphere);

        this.model?.movementController?.setTarget(point)
      }
    });

  }

  public loadVrm(url: string) {
    if (this.model?.vrm) {
      this.unloadVrm()
    }

    this.model = new Model(this._camera || new THREE.Object3D())
    this.model.loadVrm(url).then(async () => {
      if (!this.model?.vrm) return

      // add model to scene
      this._scene.add(this.model.vrm.scene)

      // after animation play
      requestAnimationFrame(() => {
        this.model?.vrm?.springBoneManager?.reset()
        this.setCameraToHead()
        const hips = this.model?.vrm?.humanoid.getNormalizedBoneNode('hips')
        if (hips) {
          this.model?.movementController?.setPosition(hips.position)
        }
      })
    })
  }

  public unloadVrm(): void {
    if (this.model?.vrm) {
      this._scene.remove(this.model.vrm.scene)
      this.model?.unloadVrm()
    }
  }

  public setup(canvas: HTMLCanvasElement) {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // renderer
    this._renderer = new THREE.WebGPURenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    })
    this._renderer.outputColorSpace = THREE.SRGBColorSpace
    this._renderer.setSize(width, height, false)
    this._renderer.setPixelRatio(window.devicePixelRatio)
    this._viewerResizeObserver.observe(canvas)

    // disable shader error check in production
    const { MODE } = import.meta.env
    if (MODE === 'production') {
      this._renderer.debug.checkShaderErrors = false
    }

    // camera
    this._camera = new THREE.PerspectiveCamera(20.0, width / height, 0.1, 20.0)
    this._camera.position.set(0, 2, -10)

    // camera controls
    this._cameraControls = new OrbitControls(this._camera, this._renderer.domElement)
    this._cameraControls.screenSpacePanning = true
    this._cameraControls.target.set(0, 2, -11)
    this._cameraControls.update()

    // update
    this.isReady = true
    this.update()
  }

  public resize() {
    if (!this._renderer) return

    const width = this._renderer.domElement.clientWidth
    const height = this._renderer.domElement.clientHeight

    this._renderer.setPixelRatio(window.devicePixelRatio)
    this._renderer.setSize(width, height, false)

    if (!this._camera) return
    this._camera.aspect = width / height
    this._camera.updateProjectionMatrix()
  }

  public setCameraToHead(z: number = 1.5) {
    const headNode = this.model?.vrm?.humanoid.getNormalizedBoneNode('head')
    if (headNode) {
      const headWPos = headNode.getWorldPosition(new THREE.Vector3())
      this._camera?.position.set(0, headWPos.y, z)
      this._cameraControls?.target.set(headWPos.x, headWPos.y, headWPos.z)
      this._cameraControls?.update()
    }
  }

  public async update() {
    requestAnimationFrame(() => this.update())
    if (this.model?.vrm) {
      this.model.update(this._clock.getDelta())
    }
    
    if (this._renderer && this._camera) {
      await this._renderer.renderAsync(this._scene, this._camera);
    }
  }
}

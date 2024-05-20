import { Extension } from './Extension'
import {
  Box3,
  Camera,
  Euler,
  MathUtils,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  Sphere,
  Spherical,
  Vector3
} from 'three'
import {
  SmoothControlsOptions,
  SmoothOrbitControls
} from './controls/SmoothOrbitControls'
import { CameraProjection, type CameraEventPayload } from '../objects/SpeckleCamera'
import { CameraEvent, type SpeckleCamera } from '../objects/SpeckleCamera'
import Logger from 'js-logger'
import type { IViewer, SpeckleView } from '../../IViewer'
import { FlyControls } from './controls/FlyControls'

export type CanonicalView =
  | 'front'
  | 'back'
  | 'up'
  | 'top'
  | 'down'
  | 'bottom'
  | 'right'
  | 'left'
  | '3d'
  | '3D'

export type InlineView = {
  position: Vector3
  target: Vector3
}
export type PolarView = {
  azimuth: number
  polar: number
  radius?: number
  origin?: Vector3
}

export type CameraControllerOptions = SmoothControlsOptions

export function isPerspectiveCamera(camera: Camera): camera is PerspectiveCamera {
  return (camera as PerspectiveCamera).isPerspectiveCamera
}

export function isOrthographicCamera(camera: Camera): camera is OrthographicCamera {
  return (camera as OrthographicCamera).isOrthographicCamera
}

export const DefaultControllerOptions = Object.freeze<
  Required<CameraControllerOptions>
>({
  enableOrbit: true,
  enableZoom: true,
  enablePan: true,
  orbitSensitivity: 1,
  zoomSensitivity: 1,
  panSensitivity: 1,
  inputSensitivity: 1,
  minimumRadius: 1,
  maximumRadius: Infinity,
  minimumPolarAngle: Math.PI / 8,
  maximumPolarAngle: Math.PI - Math.PI / 8,
  minimumAzimuthalAngle: -Infinity,
  maximumAzimuthalAngle: Infinity,
  minimumFieldOfView: 40,
  maximumFieldOfView: 60,
  touchAction: 'none',
  infiniteZoom: true,
  zoomToCursor: true
})

export class CameraController extends Extension implements SpeckleCamera {
  protected _controls: SmoothOrbitControls
  protected _renderingCamera: PerspectiveCamera | OrthographicCamera
  protected perspectiveCamera: PerspectiveCamera
  protected orthographicCamera: OrthographicCamera
  protected _lastCameraChanged: boolean = false
  protected _options: Required<CameraControllerOptions> = DefaultControllerOptions
  protected _fly: FlyControls

  get renderingCamera(): PerspectiveCamera | OrthographicCamera {
    return this._renderingCamera
  }

  set renderingCamera(value: PerspectiveCamera | OrthographicCamera) {
    this._renderingCamera = value
  }

  public get enabled() {
    return this._controls.interactionEnabled
  }

  public set enabled(val) {
    if (val) this._controls.enableInteraction()
    else this._controls.disableInteraction()
  }

  public get fieldOfView(): number {
    return this.perspectiveCamera.fov
  }

  public set fieldOfView(value: number) {
    this.perspectiveCamera.fov = value
    this.perspectiveCamera.updateProjectionMatrix()
  }

  public get aspect(): number {
    return this.perspectiveCamera.aspect
  }

  public get controls(): SmoothOrbitControls {
    return this._controls
  }

  public get options(): Required<CameraControllerOptions> {
    return this._options
  }

  public set options(value: CameraControllerOptions) {
    this._controls.options = value
  }

  public constructor(viewer: IViewer) {
    super(viewer)
    /** Create the default perspective camera */
    this.perspectiveCamera = new PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight
    )
    // this.perspectiveCamera.up.set(0, 0, 1)
    // this.perspectiveCamera.position.set(1, 1, 1)
    // this.perspectiveCamera.updateProjectionMatrix()

    const aspect =
      this.viewer.getContainer().offsetWidth / this.viewer.getContainer().offsetHeight

    /** Create the defaultorthographic camera */
    const fustrumSize = 50
    this.orthographicCamera = new OrthographicCamera(
      (-fustrumSize * aspect) / 2,
      (fustrumSize * aspect) / 2,
      fustrumSize / 2,
      -fustrumSize / 2,
      0.001,
      10000
    )
    // this.orthographicCamera.up.set(0, 0, 1)
    // this.orthographicCamera.position.set(100, 100, 100)
    // this.orthographicCamera.updateProjectionMatrix()

    /** Perspective camera as default on startup */
    this.renderingCamera = this.perspectiveCamera

    // this._controls.maxPolarAngle = Math.PI / 2
    // this._controls.restThreshold = 0.001

    // this._controls.addEventListener('rest', () => {
    //   this.emit(CameraEvent.Stationary)
    // })
    // this._controls.addEventListener('controlstart', () => {
    //   this.emit(CameraEvent.Dynamic)
    // })

    // this._controls.addEventListener('controlend', () => {
    //   if (this._controls.hasRested) this.emit(CameraEvent.Stationary)
    // })

    // this._controls.addEventListener('control', () => {
    //   this.emit(CameraEvent.Dynamic)
    // })
    // this._controls = new SmoothOrbitControls(
    //   this.perspectiveCamera,
    //   this.viewer.getContainer(),
    //   this.viewer.getRenderer().renderer,
    //   this.viewer.getRenderer().scene,
    //   this.viewer.World,
    //   this._options
    // )
    // this._controls.enableInteraction()
    // this._controls.setDamperDecayTime(60)
    // this._controls.basisTransform = new Matrix4().makeRotationFromEuler(
    //   new Euler(Math.PI * 0.5)
    // )
    // this._controls.on(PointerChangeEvent.PointerChangeStart, () => {
    //   this.emit(CameraEvent.InteractionStarted)
    // })
    // this._controls.on(PointerChangeEvent.PointerChangeEnd, () => {
    //   this.emit(CameraEvent.InteractionEnded)
    // })

    this._fly = new FlyControls(this._renderingCamera, this.viewer.getContainer())

    this.viewer.getRenderer().speckleCamera = this
  }

  public on<T extends CameraEvent>(
    eventType: T,
    listener: (arg: CameraEventPayload[T]) => void
  ): void {
    super.on(eventType, listener)
  }

  public getSpherical(): Spherical {
    return this._controls.sphericalValue.clone()
  }

  public getOrigin(): Vector3 {
    return this._controls.originValue.clone()
  }

  public getTargetPosition(): Vector3 {
    return this._controls.getTargetPosition()
  }

  public getPosition(): Vector3 {
    return this._controls.getPosition()
  }

  setCameraView(
    objectIds: string[] | undefined,
    transition: boolean | undefined,
    fit?: number
  ): void
  setCameraView(
    view: CanonicalView | SpeckleView | InlineView | PolarView,
    transition: boolean | undefined,
    fit?: number
  ): void
  setCameraView(bounds: Box3, transition: boolean | undefined, fit?: number): void
  setCameraView(
    arg0:
      | string[]
      | CanonicalView
      | SpeckleView
      | InlineView
      | PolarView
      | Box3
      | undefined,
    arg1 = true,
    arg2 = 1.2
  ): void {
    if (!arg0) {
      this.zoomExtents(arg2, arg1)
    } else if (Array.isArray(arg0)) {
      this.zoom(arg0, arg2, arg1)
    } else if (this.isBox3(arg0)) {
      this.zoomToBox(arg0, arg2, arg1)
    } else {
      this.setView(arg0, arg1)
    }
    this.emit(CameraEvent.Dynamic)
  }

  public onEarlyUpdate(delta: number) {
    const changed = true //this._controls.update(undefined, this.viewer.World.worldBox)
    if (changed !== this._lastCameraChanged) {
      this.emit(changed ? CameraEvent.Dynamic : CameraEvent.Stationary)
    }
    this.emit(CameraEvent.FrameUpdate, changed)
    // this._lastCameraChanged = changed
    this._fly.update(delta)
  }

  public onLateUpdate(): void {
    this.emit(CameraEvent.LateFrameUpdate, this._lastCameraChanged)
  }

  public onResize() {
    this.perspectiveCamera.aspect =
      this.viewer.getContainer().offsetWidth / this.viewer.getContainer().offsetHeight
    this.perspectiveCamera.updateProjectionMatrix()

    const lineOfSight = new Vector3()
    this.perspectiveCamera.getWorldDirection(lineOfSight)
    // const target = new Vector3()
    // TO DO
    // this._controls.getTarget(target)
    // const distance = target.clone().sub(this.perspectiveCamera.position)
    // const depth = distance.dot(lineOfSight)
    // const dims = {
    //   x: this.viewer.getContainer().offsetWidth,
    //   y: this.viewer.getContainer().offsetHeight
    // }
    // const aspect = dims.x / dims.y
    // const fov = this.perspectiveCamera.fov
    // const height = depth * 2 * Math.atan((fov * (Math.PI / 180)) / 2)
    // const width = height * aspect

    // this.orthographicCamera.zoom = 1
    // this.orthographicCamera.left = width / -2
    // this.orthographicCamera.right = width / 2
    // this.orthographicCamera.top = height / 2
    // this.orthographicCamera.bottom = height / -2
    // this.orthographicCamera.updateProjectionMatrix()
  }

  public setPerspectiveCameraOn() {
    if (this._renderingCamera === this.perspectiveCamera) return
    this.renderingCamera = this.perspectiveCamera
    this.setupPerspectiveCamera()
    this.viewer.requestRender()
  }

  public setOrthoCameraOn(): void {
    if (this._renderingCamera === this.orthographicCamera) return
    this.renderingCamera = this.orthographicCamera
    this.setupOrthoCamera()
    this.viewer.requestRender()
  }

  public toggleCameras(): void {
    if (this._renderingCamera === this.perspectiveCamera) this.setOrthoCameraOn()
    else this.setPerspectiveCameraOn()
  }

  protected setupOrthoCamera() {
    this.controls.controlTarget = this.orthographicCamera
    this.enableRotations()
    this.setCameraPlanes(this.viewer.getRenderer().sceneBox)
    this.emit(CameraEvent.ProjectionChanged, CameraProjection.ORTHOGRAPHIC)
  }

  protected setupPerspectiveCamera() {
    this.controls.controlTarget = this.perspectiveCamera
    this.enableRotations()
    this.setCameraPlanes(this.viewer.getRenderer().sceneBox)
    this.emit(CameraEvent.ProjectionChanged, CameraProjection.PERSPECTIVE)
  }

  public disableRotations() {
    // this._controls.mouseButtons.left = CameraControls.ACTION.TRUCK
  }

  public enableRotations() {
    // this._controls.mouseButtons.left = CameraControls.ACTION.ROTATE
  }

  public setCameraPlanes(targetVolume: Box3, offsetScale: number = 1) {
    if (targetVolume.isEmpty()) {
      Logger.error('Cannot set camera planes for empty volume')
      return
    }

    const size = targetVolume.getSize(new Vector3())
    const maxSize = Math.max(size.x, size.y, size.z)
    const camFov =
      this._renderingCamera === this.perspectiveCamera ? this.fieldOfView : 55
    const camAspect =
      this._renderingCamera === this.perspectiveCamera ? this.aspect : 1.2
    const fitHeightDistance = maxSize / (2 * Math.atan((Math.PI * camFov) / 360))
    const fitWidthDistance = fitHeightDistance / camAspect
    const distance = offsetScale * Math.max(fitHeightDistance, fitWidthDistance)

    // TO DO
    // this._controls.minDistance = distance / 100
    // this._controls.maxDistance = distance * 100

    this._renderingCamera.near =
      this._renderingCamera === this.perspectiveCamera ? distance / 100 : 0.001
    this._renderingCamera.far = 100 //distance * 100
    this._renderingCamera.updateProjectionMatrix()
  }

  protected zoom(objectIds?: string[], fit?: number, transition?: boolean) {
    if (!objectIds) {
      this.zoomExtents(fit, transition)
      return
    }
    this.zoomToBox(this.viewer.getRenderer().boxFromObjects(objectIds), fit, transition)
  }

  private zoomExtents(fit = 1.2, transition = true) {
    if (this.viewer.getRenderer().clippingVolume.isEmpty()) {
      const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))
      this.zoomToBox(box, fit, transition)
      return
    }

    const box = this.viewer.getRenderer().clippingVolume
    /** This is for special cases like when the stream will only have one point
     *  which three will not consider it's size when computing the bounding box
     *  resulting in a zero size bounding box. That's why we make sure the bounding
     *  box is never zero in size
     */
    if (box.min.equals(box.max)) {
      box.expandByVector(new Vector3(1, 1, 1))
    }
    this.zoomToBox(box, fit, transition)
    // this.viewer.controls.setBoundary( box )
  }

  private zoomToBox(box: Box3, fit = 1.2, _transition = true) {
    _transition
    if (box.max.x === Infinity || box.max.x === -Infinity) {
      box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))
    }

    const targetSphere = new Sphere()
    box.getBoundingSphere(targetSphere)
    let radius = targetSphere.radius

    if (isPerspectiveCamera(this._renderingCamera)) {
      // https://stackoverflow.com/a/44849975
      const vFOV = this._renderingCamera.getEffectiveFOV() * MathUtils.DEG2RAD
      const hFOV = Math.atan(Math.tan(vFOV * 0.5) * this._renderingCamera.aspect) * 2
      const fov = 1 < this._renderingCamera.aspect ? vFOV : hFOV
      radius = radius / Math.sin(fov * 0.5)
    } else if (isOrthographicCamera(this._renderingCamera)) {
      // TO DO
      //   const width = this._camera.right - this._camera.left
      //   const height = this._camera.top - this._camera.bottom
      //   const diameter = 2 * boundingSphere.radius
      //   const zoom = Math.min(width / diameter, height / diameter)
      //   promises.push(this.zoomTo(zoom, enableTransition))
    }
    targetSphere.radius = radius * fit
    // this._controls.fitToSphere(targetSphere)

    this.setCameraPlanes(box, fit)
  }

  private isSpeckleView(
    view: CanonicalView | SpeckleView | InlineView | PolarView
  ): view is SpeckleView {
    return (view as SpeckleView).name !== undefined
  }

  private isCanonicalView(
    view: CanonicalView | SpeckleView | InlineView | PolarView
  ): view is CanonicalView {
    return typeof (view as CanonicalView) === 'string'
  }

  private isInlineView(
    view: CanonicalView | SpeckleView | InlineView | PolarView
  ): view is InlineView {
    return (
      (view as InlineView).position !== undefined &&
      (view as InlineView).target !== undefined
    )
  }

  private isPolarView(
    view: CanonicalView | SpeckleView | InlineView | PolarView
  ): view is PolarView {
    return (
      (view as PolarView).azimuth !== undefined &&
      (view as PolarView).polar !== undefined
    )
  }

  private isBox3(
    view: CanonicalView | SpeckleView | InlineView | PolarView | Box3
  ): view is Box3 {
    return view instanceof Box3
  }

  protected setView(
    view: CanonicalView | SpeckleView | InlineView | PolarView,
    transition = true
  ): void {
    if (this.isSpeckleView(view)) {
      this.setViewSpeckle(view, transition)
    }
    if (this.isCanonicalView(view)) {
      this.setViewCanonical(view, transition)
    }
    if (this.isInlineView(view)) {
      this.setViewInline(view, transition)
    }
    if (this.isPolarView(view)) {
      this.setViewPolar(view, transition)
    }
  }

  private setViewSpeckle(_view: SpeckleView, transition = true) {
    transition
    // TO DO
    // this._controls.setLookAt(
    //   view.view.origin['x'],
    //   view.view.origin['y'],
    //   view.view.origin['z'],
    //   view.view.target['x'],
    //   view.view.target['y'],
    //   view.view.target['z'],
    //   transition
    // )
    this.enableRotations()
  }

  /**
   * Rotates camera to some canonical views
   * @param  {string}  side       Can be any of front, back, up (top), down (bottom), right, left.
   * @param  {Number}  fit        [description]
   * @param  {Boolean} transition [description]
   * @return {[type]}             [description]
   */
  private setViewCanonical(side: string, transition = true) {
    transition
    // const DEG90 = Math.PI * 0.5
    // const DEG180 = Math.PI

    switch (side) {
      case 'front':
        this.zoomExtents()
        // TO DO
        // this._controls.rotateTo(0, DEG90, transition)
        if (this._renderingCamera === this.orthographicCamera) this.disableRotations()
        break

      case 'back':
        this.zoomExtents()
        // TO DO
        // this._controls.rotateTo(DEG180, DEG90, transition)
        if (this._renderingCamera === this.orthographicCamera) this.disableRotations()
        break

      case 'up':
      case 'top':
        this.zoomExtents()
        // TO DO
        // this._controls.rotateTo(0, 0, transition)
        if (this._renderingCamera === this.orthographicCamera) this.disableRotations()
        break

      case 'down':
      case 'bottom':
        this.zoomExtents()
        // TO DO
        // this._controls.rotateTo(0, DEG180, transition)
        if (this._renderingCamera === this.orthographicCamera) this.disableRotations()
        break

      case 'right':
        this.zoomExtents()
        // TO DO
        // this._controls.rotateTo(DEG90, DEG90, transition)
        if (this._renderingCamera === this.orthographicCamera) this.disableRotations()
        break

      case 'left':
        this.zoomExtents()
        // TO DO
        // this._controls.rotateTo(-DEG90, DEG90, transition)
        if (this._renderingCamera === this.orthographicCamera) this.disableRotations()
        break

      case '3d':
      case '3D':
      default: {
        let box
        if (this.viewer.getRenderer().allObjects.children.length === 0)
          box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))
        else box = new Box3().setFromObject(this.viewer.getRenderer().allObjects)
        if (box.max.x === Infinity || box.max.x === -Infinity) {
          box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))
        }
        // TO DO
        // this._controls.setPosition(box.max.x, box.max.y, box.max.z, transition)
        this.zoomExtents()
        this.enableRotations()
        break
      }
    }
  }

  private setViewInline(view: InlineView, transition = true) {
    /** This check is targeted exclusevely towards the frontend which calls this method pointlessly each frame
     *  We don't want to make pointless calculations more than we already are
     */
    const targetPosition = this._controls.getTargetPosition()
    if (
      view.position.equals(targetPosition) &&
      view.target.equals(this._controls.originValue)
    )
      return

    const v0 = new Vector3()
      .copy(view.position)
      .applyMatrix4(
        new Matrix4().makeRotationFromEuler(new Euler(Math.PI * 0.5)).invert()
      )
    v0.sub(view.target)
    const spherical = new Spherical()
    spherical.setFromCartesianCoords(v0.x, v0.y, v0.z)
    this._controls.setOrbit(spherical.theta, spherical.phi, spherical.radius)
    this._controls.setTarget(view.target.x, view.target.y, view.target.z)
    if (!transition) this._controls.jumpToGoal()

    this.enableRotations()
  }

  private setViewPolar(_view: PolarView, transition = true) {
    transition
    // TO DO
    this._controls.setOrbit(_view.azimuth, _view.polar, _view.radius)
    if (_view.origin)
      this._controls.setTarget(_view.origin.x, _view.origin.y, _view.origin.z)
    if (!transition) this._controls.jumpToGoal()
    this.enableRotations()
  }
}

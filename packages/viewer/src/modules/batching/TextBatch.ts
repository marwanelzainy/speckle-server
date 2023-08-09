/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
import { Box3, Color, Material, Object3D, WebGLRenderer } from 'three'

import { NodeRenderView } from '../tree/NodeRenderView'
import { AllBatchUpdateRange, Batch, BatchUpdateRange, GeometryType } from './Batch'

import { SpeckleText } from '../objects/SpeckleText'
import { GlyphGeometry } from 'troika-three-text'
import { ObjectLayers } from '../SpeckleRenderer'
import SpeckleTextMaterial from '../materials/SpeckleTextMaterial'
import { FilterMaterial } from '../filtering/FilteringManager'

export default class TextBatch implements Batch {
  public id: string
  public subtreeId: string
  public renderViews: NodeRenderView[]
  private geometry: GlyphGeometry
  public batchMaterial: Material
  public mesh: SpeckleText
  private insertedRanges: BatchUpdateRange[] = []

  public get bounds(): Box3 {
    return new Box3() //this.mesh.BVH.getBoundingBox(new Box3())
  }

  public get drawCalls(): number {
    return 1
  }

  public get minDrawCalls(): number {
    return 1
  }

  public constructor(id: string, subtreeId: string, renderViews: NodeRenderView[]) {
    this.id = id
    this.subtreeId = subtreeId
    this.renderViews = renderViews
  }

  public get geometryType(): GeometryType {
    return GeometryType.TEXT
  }

  public get renderObject(): Object3D {
    return this.mesh
  }

  public getCount(): number {
    return this.geometry.index.count
  }

  public get materials(): Material[] {
    return this.mesh.material as Material[]
  }

  public setBatchMaterial(material: Material) {
    this.batchMaterial = material
  }

  public onUpdate(deltaTime: number) {
    deltaTime
  }

  public onRender(renderer: WebGLRenderer) {
    renderer
  }

  public setVisibleRange(...ranges: BatchUpdateRange[]) {}

  public getVisibleRange(): BatchUpdateRange {
    return AllBatchUpdateRange
  }

  public setBatchBuffers(...range: BatchUpdateRange[]): void {
    throw new Error('Method not implemented.')
  }

  public setDrawRanges(...ranges: BatchUpdateRange[]) {
    this.mesh.textMesh.material = ranges[0].material
    if (ranges[0].materialOptions && ranges[0].materialOptions.rampIndexColor) {
      this.mesh.textMesh.material.color.copy(ranges[0].materialOptions.rampIndexColor)
    }
  }

  public resetDrawRanges() {
    this.mesh.textMesh.material = this.batchMaterial
    this.mesh.textMesh.visible = true
    // this.geometry.clearGroups()
    // this.geometry.setDrawRange(0, Infinity)
  }

  public async buildBatch() {
    this.mesh = new SpeckleText(this.id)
    this.mesh.matrixAutoUpdate = false
    await this.mesh.update(
      SpeckleText.SpeckleTextParamsFromMetadata(
        this.renderViews[0].renderData.geometry.metaData
      )
    )
    this.mesh.matrix.copy(this.renderViews[0].renderData.geometry.bakeTransform)
    this.renderViews[0].setBatchData(
      this.id,
      0,
      this.mesh.textMesh.geometry.index.length / 3
    )
    this.mesh.textMesh.material = this.batchMaterial
    this.mesh.layers.set(ObjectLayers.STREAM_CONTENT_TEXT)
    this.mesh.textMesh.layers.set(ObjectLayers.STREAM_CONTENT_TEXT)
  }

  public getRenderView(index: number): NodeRenderView {
    return this.renderViews[0]
  }

  public getMaterialAtIndex(index: number): Material {
    return this.batchMaterial
  }

  public getMaterial(rv: NodeRenderView): Material {
    return this.batchMaterial
  }

  public purge() {
    this.renderViews.length = 0
    this.geometry.dispose()
    this.batchMaterial.dispose()
    this.mesh = null
  }
}

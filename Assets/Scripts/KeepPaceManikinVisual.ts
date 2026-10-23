/**
 * KeepPaceManikinVisual: gives the preview stand-in manikin its rounded-box look.
 *
 * Owns: replacing each child part's unit sphere with a unit superellipsoid (MeshBuilder),
 * so the chest reads as a flat-topped block with soft edges and the head as an egg.
 * Part sizes and positions stay on the child transforms (scale = size in cm).
 *
 * Must not: touch input, colliders or session state. Hiding on device is done by
 * KeepPaceTorsoInput (this object is its placeholderVisual).
 */

/** Profile exponents per part name: [vertical, horizontal]. 1 = ellipsoid, lower = boxier. */
const PROFILES: {[name: string]: [number, number]} = {
  Chest: [0.4, 0.6],
  Abdomen: [0.5, 0.7],
  Shoulders: [0.5, 0.5],
  UpperArmLeft: [0.8, 0.8],
  UpperArmRight: [0.8, 0.8],
  Neck: [0.9, 0.8],
  Head: [0.9, 0.9],
  Nose: [1, 1],
  LowerSternumMark: [0.3, 0.3],
}

function sgnPow(t: number, p: number): number {
  return Math.sign(t) * Math.pow(Math.abs(t), p)
}

/** Unit superellipsoid (diameter 1) centered on the origin. */
function buildSuperEllipsoidMesh(n1: number, n2: number, segU: number = 48, segV: number = 24): RenderMesh {
  const b = new MeshBuilder([
    {name: "position", components: 3},
    {name: "normal", components: 3, normalized: true},
    {name: "texture0", components: 2},
  ])
  b.topology = MeshTopology.Triangles
  b.indexType = MeshIndexType.UInt16
  for (let i = 0; i <= segV; i++) {
    const v = -Math.PI / 2 + (i / segV) * Math.PI
    const cv = Math.cos(v)
    const sv = Math.sin(v)
    for (let j = 0; j <= segU; j++) {
      const u = -Math.PI + (j / segU) * Math.PI * 2
      const cu = Math.cos(u)
      const su = Math.sin(u)
      const x = 0.5 * sgnPow(cv, n1) * sgnPow(cu, n2)
      const y = 0.5 * sgnPow(sv, n1)
      const z = 0.5 * sgnPow(cv, n1) * sgnPow(su, n2)
      let nx = sgnPow(cv, 2 - n1) * sgnPow(cu, 2 - n2)
      let ny = sgnPow(sv, 2 - n1)
      let nz = sgnPow(cv, 2 - n1) * sgnPow(su, 2 - n2)
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      nx /= len
      ny /= len
      nz /= len
      b.appendVerticesInterleaved([x, y, z, nx, ny, nz, j / segU, i / segV])
    }
  }
  const row = segU + 1
  const idx: number[] = []
  for (let i = 0; i < segV; i++) {
    for (let j = 0; j < segU; j++) {
      const a = i * row + j
      const c = a + row
      idx.push(a, c, a + 1, c, c + 1, a + 1)
    }
  }
  b.appendIndices(idx)
  b.updateMesh()
  return b.getMesh()
}

@component
export class KeepPaceManikinVisual extends BaseScriptComponent {
  onAwake(): void {
    const cache: {[key: string]: RenderMesh} = {}
    const n = this.sceneObject.getChildrenCount()
    for (let i = 0; i < n; i++) {
      const child = this.sceneObject.getChild(i)
      const profile = PROFILES[child.name]
      const rmv = child.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (!profile || !rmv) continue
      const key = profile[0] + "_" + profile[1]
      if (!cache[key]) cache[key] = buildSuperEllipsoidMesh(profile[0], profile[1])
      rmv.mesh = cache[key]
    }
  }
}

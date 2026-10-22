/**
 * KeepPaceMeshes: code-authored flat meshes for the chest cues (MeshBuilder).
 *
 * Owns: geometry for the chest target ring, its center dot, the placement preview
 * ring and the rhythm brackets. All meshes lie flat in the local XZ plane (normal +Y),
 * centered on the origin, sized in cm, so they sit on the chest plane of the torso.
 *
 * Must not: create scene objects or materials, or hold state.
 */

function newFlatBuilder(): MeshBuilder {
  const builder = new MeshBuilder([
    {name: "position", components: 3},
    {name: "normal", components: 3, normalized: true},
    {name: "texture0", components: 2},
  ])
  builder.topology = MeshTopology.Triangles
  builder.indexType = MeshIndexType.UInt16
  return builder
}

/** Flat ring (annulus) in the XZ plane, facing +Y. */
export function buildRingMesh(innerRadiusCm: number, outerRadiusCm: number, segments: number = 48): RenderMesh {
  const b = newFlatBuilder()
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    b.appendVerticesInterleaved([c * outerRadiusCm, 0, s * outerRadiusCm, 0, 1, 0, i / segments, 1])
    b.appendVerticesInterleaved([c * innerRadiusCm, 0, s * innerRadiusCm, 0, 1, 0, i / segments, 0])
  }
  const idx: number[] = []
  for (let i = 0; i < segments; i++) {
    const o0 = i * 2
    const i0 = i * 2 + 1
    const o1 = i * 2 + 2
    const i1 = i * 2 + 3
    // Counter clockwise seen from +Y.
    idx.push(o0, i0, o1, o1, i0, i1)
  }
  b.appendIndices(idx)
  b.updateMesh()
  return b.getMesh()
}

/** Flat disc in the XZ plane, facing +Y. */
export function buildDiscMesh(radiusCm: number, segments: number = 32): RenderMesh {
  const b = newFlatBuilder()
  b.appendVerticesInterleaved([0, 0, 0, 0, 1, 0, 0.5, 0.5])
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    b.appendVerticesInterleaved([Math.cos(a) * radiusCm, 0, Math.sin(a) * radiusCm, 0, 1, 0, 0.5, 0.5])
  }
  const idx: number[] = []
  for (let i = 1; i <= segments; i++) idx.push(0, i + 1, i)
  b.appendIndices(idx)
  b.updateMesh()
  return b.getMesh()
}

/**
 * Flat rounded bar in the XZ plane, facing +Y: width along X, length along Z.
 * The ends are half-discs so the bracket reads as a soft stroke.
 */
export function buildBarMesh(widthCm: number, lengthCm: number, capSegments: number = 10): RenderMesh {
  const b = newFlatBuilder()
  const r = widthCm / 2
  const half = Math.max(0, lengthCm / 2 - r)
  // Outline: right side down, bottom cap, left side up, top cap (a stadium shape).
  const pts: number[][] = []
  for (let i = 0; i <= capSegments; i++) {
    const a = (i / capSegments) * Math.PI // 0..PI, cap toward +Z
    pts.push([Math.cos(a) * r, half + Math.sin(a) * r])
  }
  for (let i = 0; i <= capSegments; i++) {
    const a = Math.PI + (i / capSegments) * Math.PI // PI..2PI, cap toward -Z
    pts.push([Math.cos(a) * r, -half + Math.sin(a) * r])
  }
  b.appendVerticesInterleaved([0, 0, 0, 0, 1, 0, 0.5, 0.5])
  for (const p of pts) b.appendVerticesInterleaved([p[0], 0, p[1], 0, 1, 0, 0.5, 0.5])
  const idx: number[] = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const a = 1 + i
    const c = 1 + ((i + 1) % n)
    idx.push(0, c, a)
  }
  b.appendIndices(idx)
  b.updateMesh()
  return b.getMesh()
}

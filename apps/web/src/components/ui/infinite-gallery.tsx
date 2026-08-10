import { FC, useRef, useState, useEffect, MutableRefObject } from 'react';
import { mat4, quat, vec2, vec3 } from 'gl-matrix';
import { ArrowUp, X } from 'lucide-react';
import { FaAngleLeft, FaAngleRight } from 'react-icons/fa';


const discVertShaderSource = `#version 300 es

uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPosition;
uniform vec4 uRotationAxisVelocity;

in vec3 aModelPosition;
in vec2 aModelUvs;
in vec3 aBarycentric;
in mat4 aInstanceMatrix;

out vec2 vUvs;
out float vAlpha;
flat out int vInstanceId;
out vec3 vBarycentric;

void main() {
    // 1. World Position
    vec4 worldPosition = uWorldMatrix * aInstanceMatrix * vec4(aModelPosition, 1.);

    // 2. Identify the center of this instance
    vec3 centerPos = (uWorldMatrix * aInstanceMatrix * vec4(0., 0., 0., 1.)).xyz;
    float radius = length(centerPos.xyz);

    // 3. Trail Logic
    // ONLY trail if this is not the center vertex AND the object isn't at the world origin
    if (length(aModelPosition) > 0.001 && length(centerPos) > 0.001) {
        vec3 rotationAxis = uRotationAxisVelocity.xyz;
        float rotationVelocity = min(.15, uRotationAxisVelocity.w * 15.);
        
        vec3 stretchDir = normalize(cross(centerPos, rotationAxis));
        vec3 relativeVertexPos = normalize(worldPosition.xyz - centerPos);
        
        float strength = dot(stretchDir, relativeVertexPos);
        float invAbsStrength = min(0., abs(strength) - 1.);
        
        strength = rotationVelocity * sign(strength) * abs(invAbsStrength * invAbsStrength * invAbsStrength + 1.);
        worldPosition.xyz += stretchDir * strength;
    }

    // 4. Spherize
    // For the cage, radius is SPHERE_RADIUS (2.0). For items, it's their distance.
    worldPosition.xyz = radius * normalize(worldPosition.xyz);

    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    
    // Fade based on depth
    vAlpha = smoothstep(0.5, 1.0, normalize(worldPosition.xyz).z) * 0.9 + 0.1;
    vUvs = aModelUvs;
    vInstanceId = gl_InstanceID;
    vBarycentric = aBarycentric;
}
`;

const discFragShaderSource = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform int uItemCount;
uniform int uAtlasSize;
uniform bool uWireframeMode;

out vec4 outColor;

in vec2 vUvs;
in float vAlpha;
flat in int vInstanceId;
in vec3 vBarycentric; 

float getEdgeIntensity() {
    vec3 d = fwidth(vBarycentric);
    vec3 a3 = smoothstep(vec3(0.0), d * 1.5, vBarycentric); 
    return 1.0 - min(min(a3.x, a3.y), a3.z);
}

void main() {
    if (uWireframeMode) {
        float edge = getEdgeIntensity();
        
        // Blender "Viewport" Colors
        vec3 faceColor = vec3(0.12, 0.12, 0.12);    // Dark charcoal
        vec3 orangeLine = vec3(1.0, 0.45, 0.0);   // Blender Orange
        
        vec3 finalRGB = mix(faceColor, orangeLine, edge);
        
        // Face is semi-transparent, lines are fully opaque
        float finalAlpha = mix(0.5, 1.0, edge) * vAlpha;
        
        outColor = vec4(finalRGB, finalAlpha);
    } else {
        // ... (Keep your existing texture logic here)
        int itemIndex = vInstanceId % uItemCount;
        int cellsPerRow = uAtlasSize;
        int cellX = itemIndex % cellsPerRow;
        int cellY = itemIndex / cellsPerRow;
        vec2 cellSize = vec2(1.0) / vec2(float(cellsPerRow));
        vec2 cellOffset = vec2(float(cellX), float(cellY)) * cellSize;
        vec2 st = vec2(vUvs.x, 1.0 - vUvs.y);
        st = st * cellSize + cellOffset;
        outColor = texture(uTex, st);
        outColor.a *= vAlpha;
    }
}`;

class Face {
  public a: number;
  public b: number;
  public c: number;

  constructor(a: number, b: number, c: number) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
}

class Vertex {
  public position: vec3;
  public normal: vec3;
  public uv: vec2;

  constructor(x: number, y: number, z: number) {
    this.position = vec3.fromValues(x, y, z);
    this.normal = vec3.create();
    this.uv = vec2.create();
  }
}

class Geometry {
  public vertices: Vertex[];
  public faces: Face[];

  constructor() {
    this.vertices = [];
    this.faces = [];
  }

  public addVertex(...args: number[]): this {
    for (let i = 0; i < args.length; i += 3) {
      const x = args[i];
      const y = args[i + 1];
      const z = args[i + 2];

      if (x !== undefined && y !== undefined && z !== undefined) {
        this.vertices.push(new Vertex(x, y, z));
      }
    }
    return this;
  }

  public addFace(...args: number[]): this {
    for (let i = 0; i < args.length; i += 3) {
      const v1 = args[i];
      const v2 = args[i + 1];
      const v3 = args[i + 2];

      if (v1 !== undefined && v2 !== undefined && v3 !== undefined) {
        this.faces.push(new Face(v1, v2, v3));
      }
    }
    return this;
  }

  public get lastVertex(): Vertex | undefined {
    return this.vertices.length > 0 ? this.vertices[this.vertices.length - 1] : undefined;
  }

  public subdivide(divisions = 1): this {
    const midPointCache: Record<string, number> = {};
    let f = this.faces;

    for (let div = 0; div < divisions; ++div) {
      const newFaces = new Array<Face>(f.length * 4);

      f.forEach((face, ndx) => {
        const mAB = this.getMidPoint(face.a, face.b, midPointCache);
        const mBC = this.getMidPoint(face.b, face.c, midPointCache);
        const mCA = this.getMidPoint(face.c, face.a, midPointCache);

        const i = ndx * 4;
        newFaces[i + 0] = new Face(face.a, mAB, mCA);
        newFaces[i + 1] = new Face(face.b, mBC, mAB);
        newFaces[i + 2] = new Face(face.c, mCA, mBC);
        newFaces[i + 3] = new Face(mAB, mBC, mCA);
      });

      f = newFaces;
    }

    this.faces = f;
    return this;
  }

  public spherize(radius = 1): this {
    this.vertices.forEach(vertex => {
      vec3.normalize(vertex.normal, vertex.position);
      vec3.scale(vertex.position, vertex.normal, radius);
    });
    return this;
  }

  public get data() {
    const unrolledVertices: number[] = [];
    const unrolledUvs: number[] = [];
    const barycentrics: number[] = [];

    this.faces.forEach((face) => {
      const vA = this.vertices[face.a]!;
      const vB = this.vertices[face.b]!;
      const vC = this.vertices[face.c]!;

      unrolledVertices.push(...Array.from(vA.position), ...Array.from(vB.position), ...Array.from(vC.position));
      unrolledUvs.push(...Array.from(vA.uv), ...Array.from(vB.uv), ...Array.from(vC.uv));
      barycentrics.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
    });

    return {
      vertices: new Float32Array(unrolledVertices),
      uvs: new Float32Array(unrolledUvs),
      barycentrics: new Float32Array(barycentrics),
      count: this.faces.length * 3
    };
  }

  public get vertexData(): Float32Array {
    return new Float32Array(this.vertices.flatMap(v => Array.from(v.position)));
  }

  public get normalData(): Float32Array {
    return new Float32Array(this.vertices.flatMap(v => Array.from(v.normal)));
  }

  public get uvData(): Float32Array {
    return new Float32Array(this.vertices.flatMap(v => Array.from(v.uv)));
  }

  public get barycentricData(): Float32Array {
    const bary = new Float32Array(this.faces.length * 9);
    this.faces.forEach((_, i) => {
      const offset = i * 9;
      bary[offset + 0] = 1; bary[offset + 1] = 0; bary[offset + 2] = 0;
      bary[offset + 3] = 0; bary[offset + 4] = 1; bary[offset + 5] = 0;
      bary[offset + 6] = 0; bary[offset + 7] = 0; bary[offset + 8] = 1;
    });
    return bary;
  }

  public get indexData(): Uint16Array {
    return new Uint16Array(this.faces.flatMap(f => [f.a, f.b, f.c]));
  }

  public getMidPoint(
    ndxA: number,
    ndxB: number,
    cache: Record<string, number>
  ): number {
    const cacheKey = ndxA < ndxB ? `k_${ndxB}_${ndxA}` : `k_${ndxA}_${ndxB}`;

    if (cache[cacheKey] !== undefined) {
      return cache[cacheKey];
    }

    const vertexA = this.vertices[ndxA];
    const vertexB = this.vertices[ndxB];

    if (!vertexA || !vertexB) {
      throw new Error(`Invalid vertex index: ${ndxA}, ${ndxB}`);
    }

    const a = vertexA.position;
    const b = vertexB.position;

    const ndx = this.vertices.length;
    cache[cacheKey] = ndx;

    this.addVertex(
      (a[0] + b[0]) * 0.5,
      (a[1] + b[1]) * 0.5,
      (a[2] + b[2]) * 0.5
    );

    return ndx;
  }

}

class IcosahedronGeometry extends Geometry {
  constructor() {
    super();
    const t = Math.sqrt(5) * 0.5 + 0.5;
    this.addVertex(
      -1,
      t,
      0,
      1,
      t,
      0,
      -1,
      -t,
      0,
      1,
      -t,
      0,
      0,
      -1,
      t,
      0,
      1,
      t,
      0,
      -1,
      -t,
      0,
      1,
      -t,
      t,
      0,
      -1,
      t,
      0,
      1,
      -t,
      0,
      -1,
      -t,
      0,
      1
    ).addFace(
      0,
      11,
      5,
      0,
      5,
      1,
      0,
      1,
      7,
      0,
      7,
      10,
      0,
      10,
      11,
      1,
      5,
      9,
      5,
      11,
      4,
      11,
      10,
      2,
      10,
      7,
      6,
      7,
      1,
      8,
      3,
      9,
      4,
      3,
      4,
      2,
      3,
      2,
      6,
      3,
      6,
      8,
      3,
      8,
      9,
      4,
      9,
      5,
      2,
      4,
      11,
      6,
      2,
      10,
      8,
      6,
      7,
      9,
      8,
      1
    );
  }
}

class DiscGeometry extends Geometry {
  constructor(steps: number = 4, radius: number = 1) {
    super();
    const width = radius * 2;
    const height = radius * 1.5;
    const cornerRadius = radius * 0.3;
    const cornerSteps = Math.max(4, Math.floor(steps / 4));

    this.addVertex(0, 0, 0);
    if (this.lastVertex) {
      this.lastVertex.uv[0] = 0.5;
      this.lastVertex.uv[1] = 0.5;
    }

    const hw = width / 2;
    const hh = height / 2;

    const addCorner = (cx: number, cy: number, startAngle: number) => {
      for (let i = 0; i <= cornerSteps; ++i) {
        const t = i / cornerSteps;
        const angle = startAngle + t * (Math.PI / 2);
        const x = cx + Math.cos(angle) * cornerRadius;
        const y = cy + Math.sin(angle) * cornerRadius;

        this.addVertex(x, y, 0);

        if (this.lastVertex) {
          this.lastVertex.uv[0] = (x / width) + 0.5;
          this.lastVertex.uv[1] = (y / height) + 0.5;
        }
      }
    };

    addCorner(hw - cornerRadius, hh - cornerRadius, 0);
    addCorner(-hw + cornerRadius, hh - cornerRadius, Math.PI / 2);
    addCorner(-hw + cornerRadius, -hh + cornerRadius, Math.PI);
    addCorner(hw - cornerRadius, -hh + cornerRadius, Math.PI * 1.5);

    const totalVertices = this.vertices.length - 1;
    for (let i = 1; i < totalVertices; ++i) {
      this.addFace(0, i, i + 1);
    }

    this.addFace(0, totalVertices, 1);
  }
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (success) {
    return shader;
  }

  console.error(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function createProgram(
  gl: WebGL2RenderingContext,
  shaderSources: [string, string],
  transformFeedbackVaryings?: string[] | null,
  attribLocations?: Record<string, number>
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  const shaders: WebGLShader[] = [];

  [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].forEach((type, ndx) => {
    const shader = createShader(gl, type, shaderSources[ndx] ?? "");
    if (shader) {
      gl.attachShader(program, shader);
      shaders.push(shader);
    }
  });

  if (transformFeedbackVaryings) {
    gl.transformFeedbackVaryings(
      program,
      transformFeedbackVaryings,
      gl.SEPARATE_ATTRIBS
    );
  }

  if (attribLocations) {
    for (const [name, location] of Object.entries(attribLocations)) {
      gl.bindAttribLocation(program, location, name);
    }
  }

  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);

  if (!success) {
    console.error("Program link failed:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    shaders.forEach(s => gl.deleteShader(s));
    return null;
  }

  shaders.forEach(shader => {
    gl.detachShader(program, shader);
    gl.deleteShader(shader);
  });

  return program;
}

function makeVertexArray(
  gl: WebGL2RenderingContext,
  bufLocNumElmPairs: Array<[WebGLBuffer, number, number]>,
  indices?: Uint16Array
): WebGLVertexArrayObject | null {
  const va = gl.createVertexArray();
  if (!va) return null;

  gl.bindVertexArray(va);

  for (const [buffer, loc, numElem] of bufLocNumElmPairs) {
    if (loc === -1) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, numElem, gl.FLOAT, false, 0, 0);
  }

  if (indices) {
    const indexBuffer = gl.createBuffer();
    if (indexBuffer) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }
  }

  gl.bindVertexArray(null);
  return va;
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): boolean {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const displayWidth = Math.round(canvas.clientWidth * dpr);
  const displayHeight = Math.round(canvas.clientHeight * dpr);
  const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
  if (needResize) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  return needResize;
}

function makeBuffer(gl: WebGL2RenderingContext, sizeOrData: number | ArrayBufferView, usage: number): WebGLBuffer {
  const buf = gl.createBuffer();
  if (!buf) {
    throw new Error('Failed to create WebGL buffer.');
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);

  if (typeof sizeOrData === 'number') {
    gl.bufferData(gl.ARRAY_BUFFER, sizeOrData, usage);
  } else {
    gl.bufferData(gl.ARRAY_BUFFER, sizeOrData, usage);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return buf;
}

function createAndSetupTexture(
  gl: WebGL2RenderingContext,
  minFilter: number,
  magFilter: number,
  wrapS: number,
  wrapT: number
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('Failed to create WebGL texture.');
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  return texture;
}

type UpdateCallback = (deltaTime: number) => void;

class ArcballControl {
  private canvas: HTMLCanvasElement;
  private updateCallback: UpdateCallback;

  public isPointerDown = false;
  public orientation = quat.create();
  public pointerRotation = quat.create();
  public rotationVelocity = 0;
  public rotationAxis = vec3.fromValues(1, 0, 0);

  public snapDirection = vec3.fromValues(0, 0, -1);
  public snapTargetDirection: vec3 | null = null;

  private pointerPos = vec2.create();
  private previousPointerPos = vec2.create();
  private _rotationVelocity = 0;
  private _combinedQuat = quat.create();

  private readonly EPSILON = 0.1;
  private readonly IDENTITY_QUAT = quat.create();

  constructor(canvas: HTMLCanvasElement, updateCallback?: UpdateCallback) {
    this.canvas = canvas;
    this.updateCallback = updateCallback || (() => undefined);

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      vec2.set(this.pointerPos, e.clientX, e.clientY);
      vec2.copy(this.previousPointerPos, this.pointerPos);
      this.isPointerDown = true;
    });
    canvas.addEventListener('pointerup', () => {
      this.isPointerDown = false;
    });
    canvas.addEventListener('pointerleave', () => {
      this.isPointerDown = false;
    });
    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.isPointerDown) {
        vec2.set(this.pointerPos, e.clientX, e.clientY);
      }
    });
    canvas.style.touchAction = 'none';
  }

  public update(deltaTime: number, targetFrameDuration = 16): void {
    const timeScale = deltaTime / targetFrameDuration + 0.00001;
    let angleFactor = timeScale;
    const snapRotation = quat.create();

    if (this.isPointerDown) {
      const INTENSITY = 0.3 * timeScale;
      const ANGLE_AMPLIFICATION = 5 / timeScale;
      const midPointerPos = vec2.sub(vec2.create(), this.pointerPos, this.previousPointerPos);
      vec2.scale(midPointerPos, midPointerPos, INTENSITY);

      if (vec2.sqrLen(midPointerPos) > this.EPSILON) {
        vec2.add(midPointerPos, this.previousPointerPos, midPointerPos);

        const p = this.project(midPointerPos);
        const q = this.project(this.previousPointerPos);
        const a = vec3.normalize(vec3.create(), p);
        const b = vec3.normalize(vec3.create(), q);

        vec2.copy(this.previousPointerPos, midPointerPos);

        angleFactor *= ANGLE_AMPLIFICATION;

        this.quatFromVectors(a, b, this.pointerRotation, angleFactor);
      } else {
        quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);
      }
    } else {
      const INTENSITY = 0.1 * timeScale;
      quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);

      if (this.snapTargetDirection) {
        const SNAPPING_INTENSITY = 0.2;
        const a = this.snapTargetDirection;
        const b = this.snapDirection;
        const sqrDist = vec3.squaredDistance(a, b);
        const distanceFactor = Math.max(0.1, 1 - sqrDist * 10);
        angleFactor *= SNAPPING_INTENSITY * distanceFactor;
        this.quatFromVectors(a, b, snapRotation, angleFactor);
      }
    }

    const combinedQuat = quat.multiply(quat.create(), snapRotation, this.pointerRotation);
    this.orientation = quat.multiply(quat.create(), combinedQuat, this.orientation);
    quat.normalize(this.orientation, this.orientation);

    const RA_INTENSITY = 0.8 * timeScale;
    quat.slerp(this._combinedQuat, this._combinedQuat, combinedQuat, RA_INTENSITY);
    quat.normalize(this._combinedQuat, this._combinedQuat);

    const rad = Math.acos(this._combinedQuat[3]) * 2.0;
    const s = Math.sin(rad / 2.0);
    let rv = 0;
    if (s > 0.000001) {
      rv = rad / (2 * Math.PI);
      this.rotationAxis[0] = this._combinedQuat[0] / s;
      this.rotationAxis[1] = this._combinedQuat[1] / s;
      this.rotationAxis[2] = this._combinedQuat[2] / s;
    }

    const RV_INTENSITY = 0.5 * timeScale;
    this._rotationVelocity += (rv - this._rotationVelocity) * RV_INTENSITY;
    this.rotationVelocity = this._rotationVelocity / timeScale;

    this.updateCallback(deltaTime);
  }

  private quatFromVectors(a: vec3, b: vec3, out: quat, angleFactor = 1): { q: quat; axis: vec3; angle: number } {
    const axis = vec3.cross(vec3.create(), a, b);
    vec3.normalize(axis, axis);
    const d = Math.max(-1, Math.min(1, vec3.dot(a, b)));
    const angle = Math.acos(d) * angleFactor;
    quat.setAxisAngle(out, axis, angle);
    return { q: out, axis, angle };
  }

  private project(pos: vec2): vec3 {
    const r = 2;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const s = Math.max(w, h) - 1;

    const x = (2 * pos[0] - w - 1) / s;
    const y = (2 * pos[1] - h - 1) / s;
    let z = 0;
    const xySq = x * x + y * y;
    const rSq = r * r;

    if (xySq <= rSq / 2.0) {
      z = Math.sqrt(rSq - xySq);
    } else {
      z = rSq / Math.sqrt(xySq);
    }
    return vec3.fromValues(-x, y, z);
  }
}

interface MenuItem {
  image: string;
  link: string;
  title: string;
  description: string;
}

type ActiveItemCallback = (index: number) => void;
type MovementChangeCallback = (isMoving: boolean) => void;
type InitCallback = (instance: InfiniteGridMenu) => void;

interface Camera {
  matrix: mat4;
  near: number;
  far: number;
  fov: number;
  aspect: number;
  position: vec3;
  up: vec3;
  matrices: {
    view: mat4;
    projection: mat4;
    inversProjection: mat4;
  };
}

class InfiniteGridMenu {
  private gl: WebGL2RenderingContext | null = null;
  private discProgram: WebGLProgram | null = null;
  private discVAO: WebGLVertexArrayObject | null = null;
  private icoVAO: WebGLVertexArrayObject | null = null;
  private icoBuffers!: {
  vertices: Float32Array;
  uvs: Float32Array;
  barycentrics: Float32Array;
  count: number;
};

  private discBuffers!: {
  vertices: Float32Array;
  uvs: Float32Array;
  barycentrics: Float32Array;
  count: number;
};
  private icoGeo!: IcosahedronGeometry;
  private discGeo!: DiscGeometry;
  private worldMatrix = mat4.create();
  private tex: WebGLTexture | null = null;
  private control!: ArcballControl;

  private discLocations!: {
    aModelPosition: number;
    aModelUvs: number;
    aBarycentric: number;
    aInstanceMatrix: number;
    uWorldMatrix: WebGLUniformLocation | null;
    uViewMatrix: WebGLUniformLocation | null;
    uProjectionMatrix: WebGLUniformLocation | null;
    uCameraPosition: WebGLUniformLocation | null;
    uScaleFactor: WebGLUniformLocation | null;
    uRotationAxisVelocity: WebGLUniformLocation | null;
    uTex: WebGLUniformLocation | null;
    uFrames: WebGLUniformLocation | null;
    uItemCount: WebGLUniformLocation | null;
    uAtlasSize: WebGLUniformLocation | null;
    uWireframeMode: WebGLUniformLocation | null;
    uWireframeColor: WebGLUniformLocation | null;
  };

  private viewportSize = vec2.create();
  private drawBufferSize = vec2.create();

  private discInstances!: {
    matricesArray: Float32Array;
    matrices: Float32Array[];
    buffer: WebGLBuffer | null;
  };

  private instancePositions: vec3[] = [];
  private DISC_INSTANCE_COUNT = 0;
  private atlasSize = 1;

  private _time = 0;
  private _deltaTime = 0;
  private _deltaFrames = 0;
  private _frames = 0;

  private movementActive = false;

  private TARGET_FRAME_DURATION = 1000 / 60;
  private SPHERE_RADIUS = 2;

  public camera: Camera = {
    matrix: mat4.create(),
    near: 0.1,
    far: 40,
    fov: Math.PI / 4,
    aspect: 1,
    position: vec3.fromValues(0, 0, 3),
    up: vec3.fromValues(0, 1, 0),
    matrices: {
      view: mat4.create(),
      projection: mat4.create(),
      inversProjection: mat4.create()
    }
  };

  public smoothRotationVelocity = 0;
  public scaleFactor = 1.0;
  public wireframeMode = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private items: MenuItem[],
    private onActiveItemChange: ActiveItemCallback,
    private onMovementChange: MovementChangeCallback,
    onInit?: InitCallback,
    scale: number = 1.0
  ) {
    this.scaleFactor = scale;
    this.camera.position[2] = 3 * scale;
    this.init(onInit);
  }

  public setWireframeMode(enabled: boolean): void {
    this.wireframeMode = enabled;
  }

  public resize(): void {
    const needsResize = resizeCanvasToDisplaySize(this.canvas);
    if (!this.gl) return;
    if (needsResize) {
      this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    }
    this.updateProjectionMatrix();
  }

  public run(time = 0): void {
    this._deltaTime = Math.min(32, time - this._time);
    this._time = time;
    this._deltaFrames = this._deltaTime / this.TARGET_FRAME_DURATION;
    this._frames += this._deltaFrames;

    this.animate(this._deltaTime);
    this.render();

    requestAnimationFrame(t => this.run(t));
  }

  private init(onInit?: InitCallback): void {
    const gl = this.canvas.getContext('webgl2', {
      antialias: true,
      alpha: true
    });
    if (!gl) {
      throw new Error('No WebGL 2 context!');
    }
    this.gl = gl;

    vec2.set(this.viewportSize, this.canvas.clientWidth, this.canvas.clientHeight);
    vec2.clone(this.drawBufferSize);

    this.discProgram = createProgram(gl, [discVertShaderSource, discFragShaderSource], null, {
      aModelPosition: 0,
      aModelNormal: 1,
      aModelUvs: 2,
      aBarycentric: 3,
      aInstanceMatrix: 4
    });

    this.discLocations = {
      aModelPosition: gl.getAttribLocation(this.discProgram!, 'aModelPosition'),
      aModelUvs: gl.getAttribLocation(this.discProgram!, 'aModelUvs'),
      aBarycentric: gl.getAttribLocation(this.discProgram!, 'aBarycentric'),
      aInstanceMatrix: gl.getAttribLocation(this.discProgram!, 'aInstanceMatrix'),
      uWorldMatrix: gl.getUniformLocation(this.discProgram!, 'uWorldMatrix'),
      uViewMatrix: gl.getUniformLocation(this.discProgram!, 'uViewMatrix'),
      uProjectionMatrix: gl.getUniformLocation(this.discProgram!, 'uProjectionMatrix'),
      uCameraPosition: gl.getUniformLocation(this.discProgram!, 'uCameraPosition'),
      uScaleFactor: gl.getUniformLocation(this.discProgram!, 'uScaleFactor'),
      uRotationAxisVelocity: gl.getUniformLocation(this.discProgram!, 'uRotationAxisVelocity'),
      uTex: gl.getUniformLocation(this.discProgram!, 'uTex'),
      uFrames: gl.getUniformLocation(this.discProgram!, 'uFrames'),
      uItemCount: gl.getUniformLocation(this.discProgram!, 'uItemCount'),
      uAtlasSize: gl.getUniformLocation(this.discProgram!, 'uAtlasSize'),
      uWireframeMode: gl.getUniformLocation(this.discProgram!, 'uWireframeMode'),
      uWireframeColor: gl.getUniformLocation(this.discProgram!, 'uWireframeColor')
    };

    this.discGeo = new DiscGeometry(56, 1);
    this.discBuffers = this.discGeo.data;
    this.discVAO = makeVertexArray(
      gl,
      [
        [makeBuffer(gl, this.discBuffers.vertices, gl.STATIC_DRAW), this.discLocations.aModelPosition, 3],
        [makeBuffer(gl, this.discBuffers.uvs, gl.STATIC_DRAW), this.discLocations.aModelUvs, 2],
        [makeBuffer(gl, this.discBuffers.barycentrics, gl.STATIC_DRAW), this.discLocations.aBarycentric, 3]
      ]
      // Note: The third argument (indices) is removed here
    );

    this.icoGeo = new IcosahedronGeometry();
    this.icoGeo.subdivide(1).spherize(this.SPHERE_RADIUS); // Subdivide more for a denser cage
    this.icoBuffers = this.icoGeo.data;

    this.icoVAO = makeVertexArray(
      gl,
      [
        [makeBuffer(gl, this.icoBuffers.vertices, gl.STATIC_DRAW), this.discLocations.aModelPosition, 3],
        [makeBuffer(gl, this.icoBuffers.uvs, gl.STATIC_DRAW), this.discLocations.aModelUvs, 2],
        [makeBuffer(gl, this.icoBuffers.barycentrics, gl.STATIC_DRAW), this.discLocations.aBarycentric, 3]
      ]
    );
    this.instancePositions = this.icoGeo.vertices.map(v => v.position);
    this.DISC_INSTANCE_COUNT = this.icoGeo.vertices.length;
    this.initDiscInstances(this.DISC_INSTANCE_COUNT);
    this.initTexture();
    this.control = new ArcballControl(this.canvas, deltaTime => this.onControlUpdate(deltaTime));

    this.updateCameraMatrix();
    this.updateProjectionMatrix();

    this.resize();

    if (onInit) {
      onInit(this);
    }
  }

  private initTexture(): void {
    if (!this.gl) return;
    const gl = this.gl;
    this.tex = createAndSetupTexture(gl, gl.LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);

    const itemCount = Math.max(1, this.items.length);
    this.atlasSize = Math.ceil(Math.sqrt(itemCount));
    const cellSize = 512;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = this.atlasSize * cellSize;
    canvas.height = this.atlasSize * cellSize;

    Promise.all(
      this.items.map(
        item =>
          new Promise<HTMLImageElement>(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.src = item.image;
          })
      )
    ).then(images => {
      images.forEach((img, i) => {
        const x = (i % this.atlasSize) * cellSize;
        const y = Math.floor(i / this.atlasSize) * cellSize;
        ctx.drawImage(img, x, y, cellSize, cellSize);
      });

      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    });
  }

  private initDiscInstances(count: number): void {
    if (!this.gl || !this.discVAO) return;
    const gl = this.gl;

    const matricesArray = new Float32Array(count * 16);
    const matrices: Float32Array[] = [];
    for (let i = 0; i < count; ++i) {
      const instanceMatrixArray = new Float32Array(matricesArray.buffer, i * 16 * 4, 16);
      mat4.identity(instanceMatrixArray as unknown as mat4);
      matrices.push(instanceMatrixArray);
    }

    this.discInstances = {
      matricesArray,
      matrices,
      buffer: gl.createBuffer()
    };

    gl.bindVertexArray(this.discVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.discInstances.matricesArray.byteLength, gl.DYNAMIC_DRAW);

    const mat4AttribSlotCount = 4;
    const bytesPerMatrix = 16 * 4;
    for (let j = 0; j < mat4AttribSlotCount; ++j) {
      const loc = this.discLocations.aInstanceMatrix + j;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, bytesPerMatrix, j * 4 * 4);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }

  private animate(deltaTime: number): void {
    if (!this.gl) return;
    this.control.update(deltaTime, this.TARGET_FRAME_DURATION);

    const positions = this.instancePositions.map(p => vec3.transformQuat(vec3.create(), p, this.control.orientation));
    const scale = 0.25;
    const SCALE_INTENSITY = 0.6;

    positions.forEach((p, ndx) => {
      const s = (Math.abs(p[2]) / this.SPHERE_RADIUS) * SCALE_INTENSITY + (1 - SCALE_INTENSITY);
      const finalScale = s * scale;
      const matrix = mat4.create();

      mat4.multiply(matrix, matrix, mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), p)));
      mat4.multiply(matrix, matrix, mat4.targetTo(mat4.create(), [0, 0, 0], p, [0, 1, 0]));
      mat4.multiply(matrix, matrix, mat4.fromScaling(mat4.create(), [finalScale, finalScale, finalScale]));
      mat4.multiply(matrix, matrix, mat4.fromTranslation(mat4.create(), [0, 0, -this.SPHERE_RADIUS]));

      const targetMatrix = this.discInstances.matrices[ndx];

      if (targetMatrix) {
        mat4.copy(targetMatrix, matrix);
      } else {
        console.warn(`Matrix at index ${ndx} is undefined`);
      }
    });

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.discInstances.buffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.discInstances.matricesArray);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

    this.smoothRotationVelocity = this.control.rotationVelocity;
  }

private render(): void {
    if (!this.gl || !this.discProgram || !this.discVAO || !this.icoVAO) return;
    const gl = this.gl;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.discProgram);

    // Set Common Uniforms
    gl.uniformMatrix4fv(this.discLocations.uWorldMatrix, false, this.worldMatrix);
    gl.uniformMatrix4fv(this.discLocations.uViewMatrix, false, this.camera.matrices.view);
    gl.uniformMatrix4fv(this.discLocations.uProjectionMatrix, false, this.camera.matrices.projection);
    gl.uniform3fv(this.discLocations.uCameraPosition, this.camera.position);
    gl.uniform4f(this.discLocations.uRotationAxisVelocity, 
        this.control.rotationAxis[0], this.control.rotationAxis[1], this.control.rotationAxis[2], 
        this.control.rotationVelocity
    );
    gl.uniform1i(this.discLocations.uItemCount, this.items.length);
    gl.uniform1i(this.discLocations.uAtlasSize, this.atlasSize);

    // --- PASS 1: DRAW WIREFRAME CAGE (always visible when enabled) ---
    if (this.wireframeMode) {
      gl.bindVertexArray(this.icoVAO);
      gl.uniform1i(this.discLocations.uWireframeMode, 1);

      // Disable instancing for the cage
      for (let j = 0; j < 4; ++j) {
          gl.vertexAttribDivisor(this.discLocations.aInstanceMatrix + j, 0);
      }

      const identity = mat4.create();
      for (let j = 0; j < 4; j++) {
          // CAST to any to bypass the TypeScript "IndexedCollection" error
          const col = (identity as any).subarray(j * 4, j * 4 + 4);
          gl.vertexAttrib4fv(this.discLocations.aInstanceMatrix + j, col);
      }

      gl.drawArrays(gl.TRIANGLES, 0, this.icoBuffers.count);
    }

    // --- PASS 2: DRAW IMAGES (DISCS) - always drawn ---
    gl.bindVertexArray(this.discVAO);
    gl.uniform1i(this.discLocations.uWireframeMode, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.discInstances.matricesArray);

    // IMPORTANT: Enable instance divisor for instanced draw
    for (let j = 0; j < 4; ++j) {
        gl.vertexAttribDivisor(this.discLocations.aInstanceMatrix + j, 1);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.discLocations.uTex, 0);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.discBuffers.count, this.DISC_INSTANCE_COUNT);
    gl.bindVertexArray(null);
}

  private updateCameraMatrix(): void {
    mat4.targetTo(this.camera.matrix, this.camera.position, [0, 0, 0], this.camera.up);
    mat4.invert(this.camera.matrices.view, this.camera.matrix);
  }

  private updateProjectionMatrix(): void {
    if (!this.gl) return;
    const canvasEl = this.gl.canvas as HTMLCanvasElement;
    this.camera.aspect = canvasEl.clientWidth / canvasEl.clientHeight;
    const height = this.SPHERE_RADIUS * 0.35;
    const distance = this.camera.position[2];
    if (this.camera.aspect > 1) {
      this.camera.fov = 2 * Math.atan(height / distance);
    } else {
      this.camera.fov = 2 * Math.atan(height / this.camera.aspect / distance);
    }
    mat4.perspective(
      this.camera.matrices.projection,
      this.camera.fov,
      this.camera.aspect,
      this.camera.near,
      this.camera.far
    );
    mat4.invert(this.camera.matrices.inversProjection, this.camera.matrices.projection);
  }

  private onControlUpdate(deltaTime: number): void {
    const timeScale = deltaTime / this.TARGET_FRAME_DURATION + 0.0001;
    let damping = 5 / timeScale;
    let cameraTargetZ = 3 * this.scaleFactor;

    const isMoving = this.control.isPointerDown || Math.abs(this.smoothRotationVelocity) > 0.01;

    if (isMoving !== this.movementActive) {
      this.movementActive = isMoving;
      this.onMovementChange(isMoving);
    }

    if (!this.control.isPointerDown) {
      const nearestVertexIndex = this.findNearestVertexIndex();
      const itemIndex = nearestVertexIndex % Math.max(1, this.items.length);
      this.onActiveItemChange(itemIndex);
      const snapDirection = vec3.normalize(vec3.create(), this.getVertexWorldPosition(nearestVertexIndex));
      this.control.snapTargetDirection = snapDirection;
    } else {
      cameraTargetZ += this.control.rotationVelocity * 80 + 2.5;
      damping = 7 / timeScale;
    }

    this.camera.position[2] += (cameraTargetZ - this.camera.position[2]) / damping;
    this.updateCameraMatrix();
  }

  private findNearestVertexIndex(): number {
    const n = this.control.snapDirection;
    const inversOrientation = quat.conjugate(quat.create(), this.control.orientation);
    const nt = vec3.transformQuat(vec3.create(), n, inversOrientation);

    let maxD = -1;
    let nearestVertexIndex = 0;

    for (let i = 0; i < this.instancePositions.length; ++i) {
      const pos = this.instancePositions[i];

      if (pos) {
        const d = vec3.dot(nt, pos);
        if (d > maxD) {
          maxD = d;
          nearestVertexIndex = i;
        }
      }
    }

    return nearestVertexIndex;
  }

  private getVertexWorldPosition(index: number): vec3 {
    const nearestVertexPos = this.instancePositions[index];

    if (!nearestVertexPos) {
      console.warn(`Vertex at index ${index} not found. Returning zero vector.`);
      return vec3.create();
    }

    return vec3.transformQuat(
      vec3.create(),
      nearestVertexPos,
      this.control.orientation
    );
  }
}

interface MenuItem {
  image: string;
  link: string;
  title: string;
  description: string;
}

interface ImageCarouselProps {
  items: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
  startIndex?: number;
}

export const ImageCarousel: FC<ImageCarouselProps> = ({
  items,
  isOpen,
  onClose,
  startIndex = 0
}) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isOpen]);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  if (!isOpen) return null;

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center bg-background animate-fade-in">
      <button
        onClick={onClose}
        className="top-6 right-6 z-50 absolute flex justify-center items-center hover:bg-foreground/10 rounded-full w-14 h-14 text-foreground text-5xl transition-all"
        aria-label="Close carousel"
      >
        <X />
      </button>

      <button
        onClick={prevImage}
        className="left-6 z-50 absolute flex justify-center items-center hover:bg-foreground/10 rounded-full w-16 h-16 text-foreground text-6xl transition-all"
        aria-label="Previous image"
      >
        <FaAngleLeft />
      </button>

      <div className="relative flex justify-center items-center p-20 w-full h-full">
        <img
          key={currentIndex}
          src={items[currentIndex]?.image}
          alt={items[currentIndex]?.title}
          className="max-w-full max-h-full object-contain animate-fade-in"
        />

        <div className="bottom-2 left-1/2 absolute text-foreground text-center -translate-x-1/2 transform">
          <p className="opacity-60 mt-2 text-sm">
            {currentIndex + 1} / {items.length}
          </p>
        </div>
      </div>

      <button
        onClick={nextImage}
        className="right-6 z-50 absolute flex justify-center items-center hover:bg-foreground/10 rounded-full w-16 h-16 text-foreground text-6xl transition-all"
        aria-label="Next image"
      >
        <FaAngleRight />
      </button>

      <div className="bottom-24 left-1/2 absolute flex gap-2 -translate-x-1/2 transform">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full transition-all ${index === currentIndex ? 'bg-foreground scale-125' : 'bg-foreground/40'
              }`}
            aria-label={`Go to image ${index + 1}`}
          />
        ))}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};

interface InfiniteMenuProps {
  items?: MenuItem[];
  scale?: number;
  onCarouselOpen?: () => void;
  wireframeMode?: boolean;
}

const InfiniteMenu: FC<InfiniteMenuProps> = ({
  items = [],
  scale = 1.0,
  onCarouselOpen,
  wireframeMode = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null) as MutableRefObject<HTMLCanvasElement | null>;
  const sketchRef = useRef<InfiniteGridMenu | null>(null);
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const [carouselStartIndex, setCarouselStartIndex] = useState(0);

  console.log(items)
  const defaultItems: MenuItem[] = [
    {
      image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?q=80&w=1074&auto=format&fit=crop',
      link: 'https://google.com/',
      title: 'Item 1',
      description: 'This is pretty cool, right?'
    },
    {
      image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?q=80&w=1074&auto=format&fit=crop',
      link: 'https://google.com/',
      title: 'Item 2',
      description: 'Beautiful landscapes'
    },
    {
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=1074&auto=format&fit=crop',
      link: 'https://google.com/',
      title: 'Item 3',
      description: 'Mountain views'
    },
    {
      image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1074&auto=format&fit=crop',
      link: 'https://google.com/',
      title: 'Item 4',
      description: 'Nature scenes'
    }
  ];

  const menuItems = items.length ? items : defaultItems;

  useEffect(() => {
    const canvas = canvasRef.current;

    const handleActiveItem = (index: number) => {
      if (!menuItems || menuItems.length === 0) return;
      const itemIndex = ((index % menuItems.length) + menuItems.length) % menuItems.length;
      const selectedItem = menuItems[itemIndex];
      if (selectedItem !== undefined) {
        setActiveItem(selectedItem);
      }
    };

    if (canvas) {
      sketchRef.current = new InfiniteGridMenu(
        canvas,
        menuItems,
        handleActiveItem,
        setIsMoving,
        sk => sk.run(),
        scale
      );
    }

    const handleResize = () => {
      if (sketchRef.current) {
        sketchRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (sketchRef.current) {
      sketchRef.current.setWireframeMode(wireframeMode);
    }
  }, [wireframeMode]);

  const handleButtonClick = () => {
    if (!activeItem) return;

    const activeIndex = menuItems.findIndex(
      item => item.title === activeItem.title && item.image === activeItem.image
    );

    const startIndex = activeIndex !== -1 ? activeIndex : 0;
    setCarouselStartIndex(startIndex);
    setShowCarousel(true);

    if (onCarouselOpen) {
      onCarouselOpen();
    }
  };

  return (
    <>
      <div className="relative w-full h-full">
        <canvas
          id="infinite-grid-menu-canvas"
          ref={canvasRef}
          className="relative bg-background outline-none w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
        />
        {activeItem && (
          <>
            <h2
              className={`
                select-none
                text-foreground
                absolute
                font-black
                text-6xl
                left-[1.6em]
                top-1/2
                transform
                translate-x-[20%]
                -translate-y-1/2
                transition-all
                ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
                ${isMoving
                  ? 'opacity-0 pointer-events-none duration-[100ms]'
                  : 'opacity-100 pointer-events-auto duration-[500ms]'
                }
              `}
            >
              {activeItem.title}
            </h2>
            <div
              onClick={handleButtonClick}
              className={`
                absolute
                left-1/2
                z-10
                w-[60px]
                h-[60px]
                grid
                place-items-center
                bg-blue-600
                text-white
                border-[5px]
                border-neutral-200
                dark:border-white
                rounded-full
                cursor-pointer
                transition-all
                ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
                hover:scale-110
                ${isMoving
                  ? 'bottom-[-80px] opacity-0 pointer-events-none duration-[100ms] scale-0 -translate-x-1/2'
                  : 'bottom-[3.8em] opacity-100 pointer-events-auto duration-[500ms] scale-100 -translate-x-1/2'
                }
              `}
            >
              <p className="top-1/2 absolute text-[#ffffff] text-[26px] -translate-y-1/2 select-none"><ArrowUp /></p>
            </div>
          </>
        )}
      </div>

      <ImageCarousel
        items={menuItems}
        isOpen={showCarousel}
        onClose={() => setShowCarousel(false)}
        startIndex={carouselStartIndex}
      />
    </>
  );
};

export default InfiniteMenu

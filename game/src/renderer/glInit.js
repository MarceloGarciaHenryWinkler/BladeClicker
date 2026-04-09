// glInit.js — WebGL context, buffers, batch renderer, camera
import {
  QUAD_VERT, QUAD_FRAG,
  POST_VERT, POST_FRAG,
  createProgram,
} from './shaders.js';

// Max quads per draw call (6 verts each)
const MAX_QUADS = 4096;
const FLOATS_PER_VERT = 6; // x, y, r, g, b, a
const VERTS_PER_QUAD = 6;
const BATCH_SIZE = MAX_QUADS * VERTS_PER_QUAD * FLOATS_PER_VERT;

let gl = null;
let quadProgram = null;
let postProgram = null;
let vbo = null;
let batchBuf = new Float32Array(BATCH_SIZE);
let batchOffset = 0;

// Uniform locations
let uResolution = null;
let uCamera = null;

// Camera
export const camera = { x: 0, y: 0 };

// Canvas dimensions (updated on resize)
export let width = 0;
export let height = 0;

// Framebuffer for post-processing
let fbo = null;
let fboTex = null;
let postVBO = null;
let uPostTex = null;

export function initGL(canvas) {
  gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error('WebGL not supported');

  // --- Quad program ---
  quadProgram = createProgram(gl, QUAD_VERT, QUAD_FRAG);
  uResolution = gl.getUniformLocation(quadProgram, 'u_resolution');
  uCamera = gl.getUniformLocation(quadProgram, 'u_camera');

  // VBO for batched quads
  vbo = gl.createBuffer();

  // --- Post-processing program ---
  postProgram = createProgram(gl, POST_VERT, POST_FRAG);
  uPostTex = gl.getUniformLocation(postProgram, 'u_tex');

  // Fullscreen triangle-strip quad
  postVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, postVBO);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1, 1, 1,
  ]), gl.STATIC_DRAW);

  // Enable blending
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Initial resize
  handleResize(canvas);
  window.addEventListener('resize', () => handleResize(canvas));

  return gl;
}

function handleResize(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  // Recreate FBO at new size
  createFBO(canvas.width, canvas.height);
}

function createFBO(w, h) {
  if (fboTex) gl.deleteTexture(fboTex);
  if (fbo) gl.deleteFramebuffer(fbo);

  fboTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, fboTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// --- Begin a frame: render to FBO ---
export function beginFrame() {
  const canvas = gl.canvas;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.039, 0.039, 0.071, 1.0); // #0a0a12
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(quadProgram);
  gl.uniform2f(uResolution, width / 2, height / 2);
  gl.uniform2f(uCamera, camera.x, camera.y);

  batchOffset = 0;
}

// --- Push a colored quad into the batch ---
export function pushQuad(x, y, w, h, r, g, b, a) {
  if (batchOffset + VERTS_PER_QUAD * FLOATS_PER_VERT > BATCH_SIZE) {
    flushQuads();
  }
  const x1 = x, y1 = y, x2 = x + w, y2 = y + h;
  const o = batchOffset;
  // Triangle 1
  batchBuf[o   ] = x1; batchBuf[o+1 ] = y1; batchBuf[o+2 ] = r; batchBuf[o+3 ] = g; batchBuf[o+4 ] = b; batchBuf[o+5 ] = a;
  batchBuf[o+6 ] = x2; batchBuf[o+7 ] = y1; batchBuf[o+8 ] = r; batchBuf[o+9 ] = g; batchBuf[o+10] = b; batchBuf[o+11] = a;
  batchBuf[o+12] = x1; batchBuf[o+13] = y2; batchBuf[o+14] = r; batchBuf[o+15] = g; batchBuf[o+16] = b; batchBuf[o+17] = a;
  // Triangle 2
  batchBuf[o+18] = x2; batchBuf[o+19] = y1; batchBuf[o+20] = r; batchBuf[o+21] = g; batchBuf[o+22] = b; batchBuf[o+23] = a;
  batchBuf[o+24] = x2; batchBuf[o+25] = y2; batchBuf[o+26] = r; batchBuf[o+27] = g; batchBuf[o+28] = b; batchBuf[o+29] = a;
  batchBuf[o+30] = x1; batchBuf[o+31] = y2; batchBuf[o+32] = r; batchBuf[o+33] = g; batchBuf[o+34] = b; batchBuf[o+35] = a;
  batchOffset += VERTS_PER_QUAD * FLOATS_PER_VERT;
}

// --- Flush batched quads to GPU ---
export function flushQuads() {
  if (batchOffset === 0) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, batchBuf.subarray(0, batchOffset), gl.DYNAMIC_DRAW);

  const stride = FLOATS_PER_VERT * 4;
  const aPos = gl.getAttribLocation(quadProgram, 'a_pos');
  const aCol = gl.getAttribLocation(quadProgram, 'a_color');

  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aCol);
  gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, stride, 8);

  gl.drawArrays(gl.TRIANGLES, 0, batchOffset / FLOATS_PER_VERT);
  batchOffset = 0;
}

// --- End frame: blit FBO to screen via post shader ---
export function endFrame() {
  flushQuads();

  // Blit to screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.useProgram(postProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fboTex);
  gl.uniform1i(uPostTex, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, postVBO);
  const aPos = gl.getAttribLocation(postProgram, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// --- Expose GL context for other modules ---
export function getGL() { return gl; }

// postFX.js — Multi-pass bloom + composite post-processing
import {
  POST_VERT, BRIGHT_FRAG, BLUR_FRAG, COMPOSITE_FRAG,
  createProgram,
} from './shaders.js';

let gl;

// Programs
let brightProg, blurProg, compositeProg;

// Uniform locations
let uBrightTex, uBrightThreshold;
let uBlurTex, uBlurTexelSize, uBlurOffset;
let uCompScene, uCompBloom, uCompBloomStrength, uCompTime;

// FBOs: ping-pong pair at half resolution for blur
let pingFBO, pongFBO;
let pingTex, pongTex;
let halfW = 0, halfH = 0;

// Fullscreen quad VBO (shared)
let fsQuadVBO;

// Bloom config
const BLOOM_THRESHOLD = 0.25;
const BLOOM_STRENGTH = 0.7;
const BLUR_PASSES = 4;
const BLUR_OFFSETS = [1.0, 1.5, 2.0, 3.0];

export function initPostFX(_gl, quadVBO) {
  gl = _gl;
  fsQuadVBO = quadVBO;

  // Compile programs
  brightProg = createProgram(gl, POST_VERT, BRIGHT_FRAG);
  uBrightTex = gl.getUniformLocation(brightProg, 'u_tex');
  uBrightThreshold = gl.getUniformLocation(brightProg, 'u_threshold');

  blurProg = createProgram(gl, POST_VERT, BLUR_FRAG);
  uBlurTex = gl.getUniformLocation(blurProg, 'u_tex');
  uBlurTexelSize = gl.getUniformLocation(blurProg, 'u_texelSize');
  uBlurOffset = gl.getUniformLocation(blurProg, 'u_offset');

  compositeProg = createProgram(gl, POST_VERT, COMPOSITE_FRAG);
  uCompScene = gl.getUniformLocation(compositeProg, 'u_scene');
  uCompBloom = gl.getUniformLocation(compositeProg, 'u_bloom');
  uCompBloomStrength = gl.getUniformLocation(compositeProg, 'u_bloomStrength');
  uCompTime = gl.getUniformLocation(compositeProg, 'u_time');
}

export function resizePostFX(canvasW, canvasH) {
  halfW = Math.floor(canvasW / 2);
  halfH = Math.floor(canvasH / 2);

  // Recreate ping-pong FBOs at half res
  pingTex = createHalfTex(pingTex);
  pongTex = createHalfTex(pongTex);

  if (pingFBO) gl.deleteFramebuffer(pingFBO);
  if (pongFBO) gl.deleteFramebuffer(pongFBO);

  pingFBO = createFBOForTex(pingTex);
  pongFBO = createFBOForTex(pongTex);
}

function createHalfTex(oldTex) {
  if (oldTex) gl.deleteTexture(oldTex);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, halfW, halfH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createFBOForTex(tex) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fb;
}

function drawFullscreenQuad(program) {
  gl.bindBuffer(gl.ARRAY_BUFFER, fsQuadVBO);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Run the full post-processing pipeline
// sceneTex = the main scene FBO texture
export function runPostFX(sceneTex, time) {
  // --- Pass 1: Bright extract → ping FBO (half res) ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, pingFBO);
  gl.viewport(0, 0, halfW, halfH);
  gl.useProgram(brightProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sceneTex);
  gl.uniform1i(uBrightTex, 0);
  gl.uniform1f(uBrightThreshold, BLOOM_THRESHOLD);
  drawFullscreenQuad(brightProg);

  // --- Pass 2: Kawase blur ping-pong ---
  const texelX = 1.0 / halfW;
  const texelY = 1.0 / halfH;

  for (let i = 0; i < BLUR_PASSES; i++) {
    const readTex = i % 2 === 0 ? pingTex : pongTex;
    const writeFBO = i % 2 === 0 ? pongFBO : pingFBO;

    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
    gl.viewport(0, 0, halfW, halfH);
    gl.useProgram(blurProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readTex);
    gl.uniform1i(uBlurTex, 0);
    gl.uniform2f(uBlurTexelSize, texelX, texelY);
    gl.uniform1f(uBlurOffset, BLUR_OFFSETS[i]);
    drawFullscreenQuad(blurProg);
  }

  // After blur, result is in the last-written FBO's texture
  const bloomTex = BLUR_PASSES % 2 === 0 ? pingTex : pongTex;

  // --- Pass 3: Composite → screen ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.useProgram(compositeProg);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sceneTex);
  gl.uniform1i(uCompScene, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, bloomTex);
  gl.uniform1i(uCompBloom, 1);

  gl.uniform1f(uCompBloomStrength, BLOOM_STRENGTH);
  gl.uniform1f(uCompTime, time);

  drawFullscreenQuad(compositeProg);
}

// shaders.js — Shader sources and compilation utilities

// --- Vertex shader: 2D quads with position + color ---
export const QUAD_VERT = `
attribute vec2 a_pos;
attribute vec4 a_color;
uniform vec2 u_resolution;
uniform vec2 u_camera;
varying vec4 v_color;

void main() {
  // World → clip space (orthographic)
  vec2 p = (a_pos - u_camera) / u_resolution * 2.0;
  p.y = -p.y; // flip Y so 0,0 = top-left
  gl_Position = vec4(p, 0.0, 1.0);
  v_color = a_color;
}
`;

// --- Fragment shader: flat color ---
export const QUAD_FRAG = `
precision mediump float;
varying vec4 v_color;

void main() {
  gl_FragColor = v_color;
}
`;

// --- Fullscreen post-processing vertex ---
export const POST_VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;

void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// --- Post-processing fragment (placeholder, expanded in Phase 5) ---
export const POST_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;

void main() {
  gl_FragColor = texture2D(u_tex, v_uv);
}
`;

// Compile a shader, return handle or throw
export function compileShader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('Shader compile error: ' + log);
  }
  return s;
}

// Link a program from vertex + fragment shader sources
export function createProgram(gl, vertSrc, fragSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error('Program link error: ' + log);
  }
  // Shaders can be detached after linking
  gl.detachShader(prog, vs);
  gl.detachShader(prog, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

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

// --- Bright-pass extract: keep pixels above threshold ---
export const BRIGHT_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_threshold;

void main() {
  vec4 c = texture2D(u_tex, v_uv);
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float contrib = max(0.0, lum - u_threshold) / max(lum, 0.001);
  gl_FragColor = vec4(c.rgb * contrib, 1.0);
}
`;

// --- Kawase blur (fast approx bloom blur) ---
export const BLUR_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texelSize;
uniform float u_offset;

void main() {
  vec4 sum = vec4(0.0);
  vec2 o = u_texelSize * u_offset;
  sum += texture2D(u_tex, v_uv + vec2(-o.x, -o.y));
  sum += texture2D(u_tex, v_uv + vec2( o.x, -o.y));
  sum += texture2D(u_tex, v_uv + vec2(-o.x,  o.y));
  sum += texture2D(u_tex, v_uv + vec2( o.x,  o.y));
  gl_FragColor = sum * 0.25;
}
`;

// --- Final composite: scene + bloom + fog + vignette + chromatic aberration ---
export const COMPOSITE_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_bloomStrength;
uniform float u_time;

void main() {
  // Chromatic aberration
  float ca = 0.002;
  vec2 dir = v_uv - 0.5;
  float dist = length(dir);
  vec2 offset = dir * dist * ca;
  float r = texture2D(u_scene, v_uv + offset).r;
  float g = texture2D(u_scene, v_uv).g;
  float b = texture2D(u_scene, v_uv - offset).b;
  vec3 scene = vec3(r, g, b);

  // Bloom
  vec3 bloom = texture2D(u_bloom, v_uv).rgb;
  vec3 col = scene + bloom * u_bloomStrength;

  // Atmospheric fog (very gentle, horizon only)
  float fogT = smoothstep(0.6, 0.9, v_uv.y);
  vec3 fogColor = vec3(0.06, 0.04, 0.14);
  col = mix(col, fogColor, fogT * 0.1);

  // Upper sky haze (subtle animated)
  float haze = smoothstep(0.4, 0.0, v_uv.y);
  float hazeWave = sin(v_uv.x * 3.0 + u_time * 0.15) * 0.5 + 0.5;
  col += vec3(0.02, 0.01, 0.04) * haze * hazeWave;

  // Vignette (very light)
  float vig = 1.0 - dist * 0.25;
  vig = clamp(vig, 0.0, 1.0);
  col *= vig;

  // Scanlines (barely visible)
  float scan = sin(gl_FragCoord.y * 1.5) * 0.008 + 1.0;
  col *= scan;

  // Tone mapping (gentle — preserves brightness)
  col = col / (col + 0.9) * 1.15;

  // Slight color grading: push shadows blue, highlights warm
  col.b += (1.0 - col.b) * 0.02;
  col.r += col.r * 0.01;

  gl_FragColor = vec4(col, 1.0);
}
`;

// --- Kept for backward compat but unused now ---
export const POST_FRAG = COMPOSITE_FRAG;

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

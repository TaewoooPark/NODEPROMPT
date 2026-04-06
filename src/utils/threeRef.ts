import type * as THREE from 'three';

let _camera: THREE.Camera | null = null;
let _gl: THREE.WebGLRenderer | null = null;

export function setThreeRefs(camera: THREE.Camera, gl: THREE.WebGLRenderer) {
  _camera = camera;
  _gl = gl;
}

export function getThreeRefs() {
  return { camera: _camera, gl: _gl };
}

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

export const coins = `const speed = 0.4; //~ number 0-10 step=0.25
const scale = 0.4;

const coin1 = {
  position: { x: 0.7, y: 0.5, z: -2 },
  radius: 1.25, //~ number 0-10 step=0.25
  height: 0.15,
  rotationSpeed: 0.02,
};

const coin2 = {
  position: { x: -1, y: -1, z: -2 },
  radius: 3,
  height: 0.15,
  rotationSpeed: 0.005,
};

let rot1;
let rot2;
let aspectRatio = 1;

function rotateY(p, rot) {
  return {
    x: p.x,
    y: p.y * rot.cos - p.z * rot.sin,
    z: p.y * rot.sin + p.z * rot.cos,
  };
}

function cylinderDistance(p, radius, height) {
  const radialDistSq = p.x ** 2 + p.z ** 2;
  const radialDist = Math.sqrt(radialDistSq) - radius;
  const heightDist = Math.abs(p.y) - height;
  if (radialDist > heightDist) {
    return { isEdge: true, dist: radialDist };
  } else {
    return { isEdge: false, dist: heightDist };
  }
}

// Combined scene distance and edge detection
function sceneDistanceWithEdge(p) {
  // Coin 1
  const p1 = {
    x: p.x - coin1.position.x * aspectRatio,
    y: p.y - coin1.position.y,
    z: p.z - coin1.position.z,
  };
  const rotatedP1 = rotateY(p1, rot1);
  const coin1Result = cylinderDistance(rotatedP1, coin1.radius, coin1.height);

  // Coin 2
  const p2 = {
    x: p.x - coin2.position.x * aspectRatio,
    y: p.y - coin2.position.y,
    z: p.z - coin2.position.z,
  };
  const rotatedP2 = rotateY(p2, rot2);
  const coin2Result = cylinderDistance(rotatedP2, coin2.radius, coin2.height);

  const minDist = Math.min(coin1Result.dist, coin2Result.dist);
  const isEdge = coin1Result.dist < coin2Result.dist ? coin1Result.isEdge : coin2Result.isEdge;

  return { distance: minDist, isEdge };
}

function castRay(ro, rd) {
  const maxDistance = 5.0;
  const minStepSize = 0.001;
  let totalDistance = 0.0;
  let isEdge = false;

  for (let i = 0; i < 32; i++) {
    const rayPos = {
      x: ro.x + rd.x * totalDistance,
      y: ro.y + rd.y * totalDistance,
      z: ro.z + rd.z * totalDistance,
    };

    const result = sceneDistanceWithEdge(rayPos);
    const stepSize = Math.max(result.distance * 0.8, minStepSize); // Slightly conservative stepping

    // Hit detection
    if (result.distance < minStepSize) {
      isEdge = result.isEdge;
      break;
    }

    totalDistance += stepSize;

    // Early termination if too far
    if (totalDistance > maxDistance) {
      return { hit: false, isEdge: false };
    }
  }

  return {
    hit: totalDistance <= maxDistance,
    isEdge,
    distance: totalDistance,
  };
}

function main(coord, context, _cursor, _buffer) {
  const x = (coord.x / context.cols) * 2.0 - 1.0;
  const y = (coord.y / context.rows) * 2.0 - 1.0;

  const rayOrigin = {
    x: x * scale * 3 * aspectRatio,
    y: -y * scale * 3,
    z: -5.0,
  };
  const rayDir = { x: 0, y: 0, z: 1.0 };

  const result = castRay(rayOrigin, rayDir);

  if (result.hit) {
    return {
      char: result.isEdge ? '|' : ':',
      color: '#238A5E',
    };
  }

  return { char: '.', color: '#2D3335' };
}

function pre(context) {
  aspectRatio = context.cols / context.rows / 2;

  // Calculate rotation based on frame number for deterministic animation
  const frameRotation1 = context.frame * coin1.rotationSpeed * speed;
  const frameRotation2 = context.frame * coin2.rotationSpeed * speed;

  // Scale radius based on columns for consistent visual size
  const radiusScale = context.cols / 144; // 144 is the default cols from settings
  coin1.radius = 1.25 * radiusScale;
  coin2.radius = 2 * radiusScale;

  // Pre-compute rotation matrices
  const phi1 = 0.25 * Math.PI + 2.0 * frameRotation1;
  rot1 = { cos: Math.cos(phi1), sin: Math.sin(phi1) };
  const phi2 = 0.15 * Math.PI + frameRotation2;
  rot2 = { cos: Math.cos(phi2), sin: Math.sin(phi2) };
}`

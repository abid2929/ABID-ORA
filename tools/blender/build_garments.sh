#!/bin/bash
# builds every garment model + variant at two levels of detail (with baked occlusion), then compresses them (meshopt)
H=$(cd "$(dirname "$0")" && pwd); OUT=$H/../../public/assets/models/fashion/clothes; TMP=${TMPDIR:-/tmp}/abclothes; mkdir -p $OUT $TMP
G=${GLTF_TRANSFORM:-gltf-transform}
for mv in "hoodie regular" "hoodie oversized" "tee crew" "tee vneck" "shirt long" "shirt short" "jeans straight" "jeans wide" "coat trench" "coat jacket"; do
  set -- $mv
  for lod in hi lo; do
    blender -b --factory-startup -P $H/garment.py -- $1 $2 $lod $TMP/$1-$2-$lod.glb >/dev/null 2>&1 || { echo "FAILED $1 $2 $lod"; continue; }
    $G meshopt $TMP/$1-$2-$lod.glb $OUT/$1-$2-$lod.glb --level medium >/dev/null 2>&1 && echo "ok $1-$2-$lod $(stat -c %s $OUT/$1-$2-$lod.glb)"
  done
done

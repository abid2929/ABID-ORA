#!/bin/bash
# builds every shoe model + shape variant at two levels of detail, then compresses them (meshopt)
H=$(cd "$(dirname "$0")" && pwd); OUT=$H/../../public/assets/models/fashion/shoes; TMP=${TMPDIR:-/tmp}/abshoes; mkdir -p $OUT $TMP
G=${GLTF_TRANSFORM:-gltf-transform}
for mv in "sneaker low" "sneaker high" "runner standard" "runner max" "derby plain" "derby captoe" "boot hiker"; do
  set -- $mv
  for lod in hi lo; do
    blender -b --factory-startup -P $H/shoe.py -- $1 $2 $lod $TMP/$1-$2-$lod.glb >/dev/null 2>&1 || { echo "FAILED $1 $2 $lod"; continue; }
    $G meshopt $TMP/$1-$2-$lod.glb $OUT/$1-$2-$lod.glb --level medium >/dev/null 2>&1 && echo "ok $1-$2-$lod $(stat -c %s $OUT/$1-$2-$lod.glb)"
  done
done

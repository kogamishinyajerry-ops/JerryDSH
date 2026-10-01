#!/bin/bash
# jerrydsh-sim-env: Ubuntu noble amd64 + OpenFOAM v1912 + Python3.12
# 工程API/worker/solver/SQLite 同一容器（同 PID namespace）
set -euo pipefail
NAME=jerrydsh-sim-env
REPO=/Users/Zhuanz/projects/jerry-personal/JerryDSH/repos/dsh-sim

echo "== [1/6] pull ubuntu:noble amd64 =="
docker pull --platform linux/amd64 ubuntu:noble

echo "== [2/6] remove stale container of same name (only ours) =="
docker rm -f $NAME 2>/dev/null || true

echo "== [3/6] run detached =="
docker run -d --name $NAME --platform linux/amd64 \
  -p 127.0.0.1:8600:8600 \
  -v "$REPO":/opt/dsh-sim \
  -v jerrydsh-sim-data:/opt/data \
  ubuntu:noble sleep infinity

echo "== [4/6] enable universe + install openfoam/python =="
docker exec $NAME bash -c '
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
SRC=/etc/apt/sources.list.d/ubuntu.sources
grep -q "^Components:" $SRC && sed -i "s/^Components: main$/Components: main universe/" $SRC
apt-get update -qq
apt-get install -y -qq ca-certificates gnupg >/dev/null
apt-get install -y -qq openfoam=1912.200626-2build3 python3.12 python3.12-venv python3.12-dev python3-pip git curl jq >/dev/null
'
echo "== [5/6] verify solver binaries + record deb sha256 =="
docker exec $NAME bash -c '
source /usr/lib/openfoam/openfoam1912/etc/bashrc
for c in blockMesh checkMesh simpleFoam foamDictionary foamToVTK; do
  command -v $c >/dev/null || { echo "MISSING: $c"; exit 1; }
  echo "OK: $c -> $(command -v $c)"
done
dpkg -s openfoam | grep -E "^(Package|Version|Architecture):"
sha256sum /var/cache/apt/archives/openfoam_*.deb 2>/dev/null || echo "(deb cache cleaned)"
uname -m
python3.12 --version
'
echo "== [6/6] record environment to host =="
docker exec $NAME bash -c 'dpkg -s openfoam | grep -E "^(Package|Version|Architecture):"; sha256sum /var/cache/apt/archives/openfoam_*.deb 2>/dev/null; uname -m' \
  > /Users/Zhuanz/projects/jerry-personal/JerryDSH/acceptance/container-setup/environment.txt 2>&1 || true
echo "ALL DONE"

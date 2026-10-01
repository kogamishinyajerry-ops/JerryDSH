#!/bin/bash
# 容器内阶段一准备：venv + dsh-sim 安装 + 环境探针 + 非真实回归
set -euo pipefail
export http_proxy=http://host.docker.internal:7897
export https_proxy=http://host.docker.internal:7897
export DEBIAN_FRONTEND=noninteractive

echo "== [1/5] python3.12 venv =="
python3.12 -m venv /opt/venv
/opt/venv/bin/pip install -q --upgrade pip

echo "== [2/5] install validation requirements + editable dsh-sim =="
/opt/venv/bin/pip install -q -r /opt/dsh-sim/requirements/validation-2026-10-01.txt
/opt/venv/bin/pip install -q --no-deps -e /opt/dsh-sim

echo "== [3/5] record versions =="
/opt/venv/bin/python --version
/opt/venv/bin/pip freeze | head -80 > /opt/data/pip-freeze.txt
sha256sum /opt/dsh-sim/src/dsh_sim/adapters/openfoam_adapter.py

echo "== [4/5] solver probe =="
source /usr/lib/openfoam/openfoam1912/etc/bashrc
for c in blockMesh checkMesh simpleFoam foamDictionary foamToVTK; do
  echo "OK: $c -> $(command -v $c)"
done

echo "== [5/5] mock regression suite (real_solver excluded by default) =="
cd /opt/dsh-sim
/opt/venv/bin/python -m pytest tests -q -m '' 2>&1 | tail -3
echo "CONTAINER-PREP-OK"

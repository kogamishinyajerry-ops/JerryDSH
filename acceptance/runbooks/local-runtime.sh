#!/bin/bash
# jerrydsh 实机验收 · 运行布局启动/停止命令（本机可直接执行）
# 布局：Mac = 隔离 DSH(web :3081) + stdio MCP venv + 浏览器
#       容器 jerrydsh-sim-env (linux/amd64, Rosetta) = 工程 API(:8600) + 常驻 worker + OpenFOAM v1912 + SQLite + artifacts
set -euo pipefail
JERRY_ROOT=/Users/Zhuanz/projects/jerry-personal/JerryDSH
ACC_RECOVERY="$JERRY_ROOT/recovery/jerrydsh-acc-0.2.0-rc.2"
VENV="$JERRY_ROOT/venvs/dsh-sim-mcp"
CONTAINER=jerrydsh-sim-env

cat <<EOF
=== [容器] 启动（若未运行） ===
docker start $CONTAINER

=== [容器] 工程 API（dev 身份，回环发布） ===
docker exec -d $CONTAINER bash -c '
  cd /opt/dsh-sim && export DSH_SIM_IDENTITY_MODE=dev \\
    DSH_SIM_DATABASE_URL=sqlite:////opt/data/dsh_sim.db \\
    DSH_SIM_ARTIFACT_ROOT=/opt/data/artifacts \\
    http_proxy= https_proxy= \\
    PATH=/usr/lib/openfoam/openfoam1912/bin:\\\$PATH \\
    /opt/venv/bin/python -m uvicorn dsh_sim.api.main:app --host 0.0.0.0 --port 8600 \\
    >> /opt/data/api.log 2>&1'
# 访问：http://127.0.0.1:8600/panels/executor/index.html

=== [容器] 常驻 worker（openfoam adapter，同容器同 PID namespace；需先 source OpenFOAM 环境） ===
docker exec -d $CONTAINER bash -c '/opt/data/launch-worker.sh >> /opt/data/worker.log 2>&1'
# launch-worker.sh 内容（已部署在容器内）：
#   source /usr/share/openfoam/etc/bashrc
#   export DSH_SIM_IDENTITY_MODE=dev DSH_SIM_DATABASE_URL=sqlite:////opt/data/dsh_sim.db
#   export DSH_SIM_ARTIFACT_ROOT=/opt/data/artifacts
#   export DSH_SIM_WORKER_ADAPTER=openfoam
#   export DSH_SIM_OPENFOAM_TEMPLATE_REGISTRY=/opt/data/openfoam-templates/registry.json
#   export DSH_SIM_OPENFOAM_TEMPLATE_ROOT=/opt/data/openfoam-templates
#   export DSH_SIM_WORKER_WORK_DIR=/opt/data/worker DSH_SIM_WORKER_NODE_ID=linux-amd64-container-01
#   exec /opt/venv/bin/python -m dsh_sim.worker.service

=== [容器] 停止 API/worker ===
docker exec $CONTAINER bash -c 'pkill -f "uvicorn dsh_sim.api.main" || true; pkill -f "dsh_sim.worker.service" || true'

=== [Mac] 隔离 DSH web（模拟 preset，:3081，不占用原 :3080 实例） ===
export DSH_HOME="$ACC_RECOVERY/dsh-home"
export DSH_SIM_PYTHON="$VENV/bin/python"
export DSH_SIM_API_URL='http://127.0.0.1:8600/api/v1'
export DSH_SIM_AGENT_PROJECTS=proj_a
"$ACC_RECOVERY/runtime/node_modules/.bin/dsh" --profile web --port 3081 \\
  --patch "$ACC_RECOVERY/overlays/simulation.local.patch.yml"

=== [Mac] 停止隔离 DSH ===
# 在其终端 Ctrl-C；或 lsof -ti :3081 | xargs kill

=== [容器] 第一阶段独立验证（validation CLI 五场景） ===
docker exec $CONTAINER bash -c '
  source /usr/lib/openfoam/openfoam1912/etc/bashrc
  cd /opt/dsh-sim
  for case in baseline transfer solver-failure cancel timeout; do
    /opt/venv/bin/python -m dsh_sim.validation.openfoam --local-validation --case \$case --output /opt/data/channel-\$case --quiet
  done'
EOF

# VoxelCraft Web: 上帝视角观测台

本项目是 `voxelcraft.ai` 的本地观测台（Top-Down Observer），用于可视化：
- 世界变化（方块变更/audit）
- 每个 agent 在做什么（动作、任务、位置、状态）

## 开发

启动后端（另一个终端，默认 `:8080`）：
```bash
cd ../voxelcraft.ai
go run ./cmd/server -addr :8080 -world world_1 -seed 1337
```

启动前端：
```bash
npm install
npm run dev
```

打开：`http://127.0.0.1:5173`

## Mock 后端（用于 E2E/开发）

```bash
npm run mock:server
```

默认会占用 `127.0.0.1:8080` 并提供：
- `GET /admin/v1/observer/bootstrap`
- `WS /admin/v1/observer/ws`

## E2E（Mock + Playwright）

```bash
npm run e2e
```

会启动：
- mock observer server (`:8080`)
- Vite dev server (`:5173`)

并用 Playwright client 生成 `output/web-game-e2e/` 下的截图与 `render_game_to_text` 状态快照。

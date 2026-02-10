Original prompt: Implement a top-down observer viewer in voxelcraft.web to visualize voxelcraft world changes and what each user/agent is doing.

## Notes
- Observer API is `/admin/v1/observer/bootstrap` + `/admin/v1/observer/ws` (WS), proxy via Vite to `http://127.0.0.1:8080`.
- The UI is a Three.js orthographic top-down map with chunk surface tiles, agent markers, and recent audit highlights.

## TODO
- Add more UI affordances (filters, search, follow toggle).
- Improve block color palette / textures.

## Updates
- Agent 列表点击即进入跟随模式（聚焦 + 跟随），并补充了状态字段展示（hp/hunger/stamina）。
- 侧边栏与提示文案统一为中文。
- 新增 `npm run e2e`：启动 mock(:8080)+Vite(:5173)+Playwright，断言 tick 增长、2 agents、chunks_loaded>0，并输出截图/状态到 `output/web-game-e2e/`。

// 百度地图 JS API 的 AK（去 https://lbsyun.baidu.com 控制台申请，启用「地图 JS API」）
// 优先读构建期环境变量 VITE_BAIDU_AK（Cloudflare Pages 的环境变量名必须带 VITE_ 前缀，
// 否则 Vite 不会把它注入到前端），读不到则回退到下方默认值。
// 注意：修改环境变量后，必须在 Cloudflare Pages 重新部署（重新构建）才会生效。
export const BAIDU_AK =
  import.meta.env.VITE_BAIDU_AK || "3nK45EVwE07POcQtPNFFOf0jtV6ImDuo";

// API 基地址：本地开发指向 Worker（如 http://localhost:8787），部署后指向 Worker 域名或留空走同域
export const API_BASE = import.meta.env.VITE_API_BASE || "";

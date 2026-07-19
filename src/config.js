// 百度地图 JS API 的 AK（去 https://lbsyun.baidu.com 控制台申请，启用「地图 JS API」）
export const BAIDU_AK = "3nK45EVwE07POcQtPNFFOf0jtV6ImDuo";

// API 基地址：本地开发指向 Worker（如 http://localhost:8787），部署后指向 Worker 域名或留空走同域
export const API_BASE = import.meta.env.VITE_API_BASE || "";

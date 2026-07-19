/**
 * Cloudflare Pages Function（与前端同域，天然无跨域）。
 * 对应路径：/api/*  —— 由 catch-all 路由 [[path]].js 接管。
 * 简单密码鉴权：登录成功返回固定的 ADMIN_TOKEN（用 wrangler pages secret put 设置）。
 *
 * 本地开发：wrangler pages dev . --d1 DB
 * 部署：    wrangler pages deploy dist
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const p = url.pathname;

  // 同域已无需跨域，这里仍回显 Origin 以兼容把 API_BASE 指向其它域的调试场景
  const origin = request.headers.get("Origin");
  const cors = {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Vary": "Origin",
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const json = (code, obj) =>
    new Response(JSON.stringify(obj), {
      status: code,
      headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
    });

  const readBody = async () => {
    try { return await request.json(); } catch { return {}; }
  };
  const ADMIN_TOKEN = env.ADMIN_TOKEN || "static-admin-token";
  const auth = () =>
    (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") === ADMIN_TOKEN;

  const genId = () => "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const cut = (v, n) => (v == null ? "" : String(v).slice(0, n));

  try {
    // 已通过审批的地点
    if (p === "/api/locations" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT * FROM locations WHERE status='approved' ORDER BY created_at DESC"
      ).all();
      return json(200, rows.results || []);
    }

    // 普通用户提交 -> 待审批
    if (p === "/api/submit" && request.method === "POST") {
      const b = await readBody();
      if (!b.name || typeof b.lat !== "number" || typeof b.lng !== "number")
        return json(400, { error: "缺少名称或坐标" });
      const id = genId();
      await env.DB.prepare(
        "INSERT INTO locations (id,name,original_name,original_addr,lat,lng,description,status,submitted_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
      ).bind(
        id, cut(b.name, 80), cut(b.originalName, 120), cut(b.originalAddr, 200),
        b.lat, b.lng, cut(b.desc, 5000), "pending", cut(b.clientId, 80) || "anonymous", Date.now()
      ).run();
      return json(201, { ok: true, id });
    }

    // 管理员登录
    if (p === "/api/login" && request.method === "POST") {
      const b = await readBody();
      if (b.password === (env.ADMIN_PASSWORD || "admin123"))
        return json(200, { token: ADMIN_TOKEN });
      return json(401, { error: "密码错误" });
    }

    // 以下均需管理员鉴权
    if (p.startsWith("/api/")) {
      if (!auth()) return json(401, { error: "未授权" });

      if (p === "/api/pending" && request.method === "GET") {
        const rows = await env.DB.prepare(
          "SELECT * FROM locations WHERE status='pending' ORDER BY created_at DESC"
        ).all();
        return json(200, rows.results || []);
      }

      if (p === "/api/locations" && request.method === "POST") {
        const b = await readBody();
        if (!b.name || typeof b.lat !== "number" || typeof b.lng !== "number")
          return json(400, { error: "缺少名称或坐标" });
        const id = genId();
        await env.DB.prepare(
          "INSERT INTO locations (id,name,original_name,original_addr,lat,lng,description,status,submitted_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
        ).bind(
          id, cut(b.name, 80), cut(b.originalName, 120), cut(b.originalAddr, 200),
          b.lat, b.lng, cut(b.desc, 5000), "approved", "admin", Date.now()
        ).run();
        return json(201, { ok: true, id });
      }

      if (p === "/api/all" && request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM locations").run();
        return json(200, { ok: true });
      }

      const m = p.match(/^\/api\/locations\/([\w-]+)(\/(approve|reject))?$/);
      if (m) {
        const id = m[1], action = m[3];
        const loc = await env.DB.prepare("SELECT * FROM locations WHERE id=?").bind(id).first();
        if (!loc) return json(404, { error: "不存在" });

        if (request.method === "PUT" && !action) {
          const b = await readBody();
          const name = b.name != null ? cut(b.name, 80) : loc.name;
          const on = b.originalName != null ? cut(b.originalName, 120) : loc.original_name;
          const oa = b.originalAddr != null ? cut(b.originalAddr, 200) : loc.original_addr;
          const desc = b.desc != null ? cut(b.desc, 5000) : loc.description;
          await env.DB.prepare(
            "UPDATE locations SET name=?, original_name=?, original_addr=?, description=?, updated_at=? WHERE id=?"
          ).bind(name, on, oa, desc, Date.now(), id).run();
          return json(200, { ok: true });
        }
        if (request.method === "POST" && action === "approve") {
          await env.DB.prepare("UPDATE locations SET status='approved', updated_at=? WHERE id=?")
            .bind(Date.now(), id).run();
          return json(200, { ok: true });
        }
        if (request.method === "POST" && action === "reject") {
          await env.DB.prepare("DELETE FROM locations WHERE id=?").bind(id).run();
          return json(200, { ok: true });
        }
        if (request.method === "DELETE" && !action) {
          await env.DB.prepare("DELETE FROM locations WHERE id=?").bind(id).run();
          return json(200, { ok: true });
        }
      }
      return json(404, { error: "not found" });
    }
  } catch (e) {
    return json(500, { error: "server error", detail: String((e && e.message) || e) });
  }
  return json(404, { error: "not found" });
}

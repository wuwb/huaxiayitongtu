import { API_BASE } from "./config";

// 设备标识，用于标记提交来源
const clientId = (() => {
  let id = localStorage.getItem("client_id");
  if (!id) {
    id = "C" + Math.random().toString(36).slice(2);
    localStorage.setItem("client_id", id);
  }
  return id;
})();

let token = localStorage.getItem("admin_token") || null;
export function getToken() { return token; }
export function setToken(t) {
  token = t;
  if (t) localStorage.setItem("admin_token", t);
  else localStorage.removeItem("admin_token");
}

function authHeader() {
  return token ? { Authorization: "Bearer " + token } : {};
}

async function req(path, opts = {}) {
  opts.headers = Object.assign({}, opts.headers || {}, authHeader());
  const r = await fetch(API_BASE + path, opts);
  if (r.status === 401 && path !== "/api/login") setToken(null);
  return r;
}

export const api = {
  clientId,
  async getLocations() {
    const r = await req("/api/locations");
    return r.json();
  },
  async submit(payload) {
    return req("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, clientId }),
    });
  },
  async login(password) {
    return fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  },
  async getPending() {
    const r = await req("/api/pending");
    return r.json();
  },
  async addLocation(payload) {
    return req("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, clientId }),
    });
  },
  async updateLocation(id, payload) {
    return req("/api/locations/" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  async deleteLocation(id) {
    return req("/api/locations/" + id, { method: "DELETE" });
  },
  async approve(id) {
    return req("/api/locations/" + id + "/approve", { method: "POST" });
  },
  async reject(id) {
    return req("/api/locations/" + id + "/reject", { method: "POST" });
  },
  async clearAll() {
    return req("/api/all", { method: "DELETE" });
  },
};

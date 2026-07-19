import React, { useState, useEffect, useRef, useCallback } from "react";
import MapView from "./MapView";
import { api, getToken, setToken } from "./api";

/* ---------- 弹窗组件 ---------- */
function AliasModal({ data, role, onConfirm, onCancel }) {
  const [name, setName] = useState(data.originalName || "");
  const [desc, setDesc] = useState("");
  return (
    <div className="overlay show">
      <div className="modal">
        <h2>为已知地点设置别名</h2>
        <div className="coord">
          原始地点：{data.originalName || "未知"}
          {data.originalAddr ? " · " + data.originalAddr : ""}
        </div>
        <div className="field">
          <label>别名（将显示在地图上）</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如给 Eiffel Tower 起别名「铁塔」" />
        </div>
        <div className="field">
          <label>描述 / 弹窗内容（待定，可自行填写）</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="弹窗要展示的内容，例如介绍、图片链接、备注等" />
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>取消</button>
          <button className="primary" onClick={() => onConfirm(name, desc)}>确定添加</button>
        </div>
      </div>
    </div>
  );
}

function AddModal({ data, onConfirm, onCancel }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <div className="overlay show">
      <div className="modal" style={{ width: 400 }}>
        <h2>在地图添加地点</h2>
        <div className="coord">坐标：{data.lat.toFixed(4)}, {data.lng.toFixed(4)}</div>
        <div className="field">
          <label>名称</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="地点名称" />
        </div>
        <div className="field">
          <label>描述 / 弹窗内容</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="弹窗内容（待定）" />
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>取消</button>
          <button className="primary" onClick={() => onConfirm(name, desc)}>确定添加</button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ loc, role, onSave, onDelete, onClose }) {
  const isAdmin = role === "admin";
  const [name, setName] = useState(loc.name || "");
  const [desc, setDesc] = useState(loc.description || "");
  return (
    <div className="overlay show">
      <div className="modal">
        <h2>{loc.name || "未命名"}</h2>
        <div className="coord">百度坐标（BD-09） 纬度 {loc.lat} · 经度 {loc.lng}</div>
        {!isAdmin && <div className="readonly-note">只读模式：仅管理员可编辑。</div>}
        <div className="field">
          <label>名称（别名）</label>
          <input value={name} disabled={!isAdmin} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>原始地名 / 地址</label>
          <input
            value={(loc.original_name || "") + (loc.original_addr ? " / " + loc.original_addr : "")}
            disabled
            style={{ color: "var(--muted)" }}
          />
        </div>
        <div className="field">
          <label>描述 / 弹窗内容</label>
          <textarea value={desc} disabled={!isAdmin} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="bad" style={{ display: isAdmin ? "" : "none" }} onClick={onDelete}>删除地点</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="ghost" onClick={onClose}>关闭</button>
            <button className="primary" style={{ display: isAdmin ? "" : "none" }} onClick={() => onSave(name, desc)}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 主应用 ---------- */
export default function App() {
  const [role, setRole] = useState(getToken() ? "admin" : "user");
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [filter, setFilter] = useState("");
  const [searchKw, setSearchKw] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchHint, setSearchHint] = useState("输入关键字，从百度地图检索已知地点。");
  const [adminAddMode, setAdminAddMode] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null); // {type:'alias'|'add'|'detail', data}
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef(null);
  const searchTimer = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }, []);

  const refresh = useCallback(async () => {
    try { setApproved(await api.getLocations()); } catch { setApproved([]); }
    if (role === "admin") {
      try { setPending(await api.getPending()); } catch { setPending([]); }
    } else setPending([]);
  }, [role]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSearchResults = useCallback((results) => {
    if (!results || results.getNumPois() === 0) {
      setSearchResults([]);
      setSearchHint("未找到结果，试试更通用的关键词。");
      return;
    }
    setSearchHint("");
    const n = Math.min(results.getNumPois(), 20);
    const arr = [];
    for (let i = 0; i < n; i++) {
      const poi = results.getPoi(i);
      arr.push({ originalName: poi.title, originalAddr: poi.address, lat: poi.point.lat, lng: poi.point.lng });
    }
    setSearchResults(arr);
  }, []);

  const onSearchChange = (e) => {
    const kw = e.target.value;
    setSearchKw(kw);
    clearTimeout(searchTimer.current);
    if (!kw) { setSearchResults([]); setSearchHint("输入关键字，从百度地图检索已知地点。"); return; }
    setSearchHint("检索中…");
    searchTimer.current = setTimeout(() => { if (searchRef.current) searchRef.current(kw); }, 400);
  };

  const openAlias = (item) => { setModal({ type: "alias", data: item }); setDrawerOpen(false); };
  const openAdd = (ll) => setModal({ type: "add", data: { lat: ll.lat, lng: ll.lng } });
  const openDetail = (id) => {
    const loc = approved.find((l) => l.id === id) || (role === "admin" ? pending.find((l) => l.id === id) : null);
    if (loc) { setModal({ type: "detail", data: loc }); setDrawerOpen(false); }
  };

  const onRoleBtn = async () => {
    if (role === "admin") {
      setToken(null); setRole("user"); setAdminAddMode(false);
      showToast("已退出管理员"); refresh(); return;
    }
    const pwd = prompt("请输入管理员密码：");
    if (!pwd) return;
    const r = await api.login(pwd);
    if (r.ok) {
      const d = await r.json();
      setToken(d.token); setRole("admin"); showToast("管理员登录成功"); refresh();
    } else showToast("密码错误");
  };

  const submitAlias = async (name, desc) => {
    const item = modal.data;
    const payload = {
      name: name || item.originalName, originalName: item.originalName,
      originalAddr: item.originalAddr, lat: item.lat, lng: item.lng, desc,
    };
    if (role === "admin") { await api.addLocation(payload); showToast("已添加（管理员直加）"); }
    else { await api.submit(payload); showToast("已提交，等待管理员审批"); }
    setModal(null); refresh();
  };
  const submitAdd = async (name, desc) => {
    const d = modal.data;
    await api.addLocation({ name: name || "未命名", lat: d.lat, lng: d.lng, desc });
    setModal(null); setAdminAddMode(false); showToast("已添加"); refresh();
  };
  const saveDetail = async (name, desc) => {
    await api.updateLocation(modal.data.id, { name, desc });
    setModal(null); showToast("已保存"); refresh();
  };
  const deleteDetail = async () => {
    if (!confirm("确定删除该地点？")) return;
    await api.deleteLocation(modal.data.id);
    setModal(null); showToast("已删除"); refresh();
  };
  const approve = async (id) => { await api.approve(id); showToast("已通过"); refresh(); };
  const reject = async (id) => {
    if (!confirm("拒绝并删除该提交？")) return;
    await api.reject(id); showToast("已拒绝"); refresh();
  };
  const clearAll = async () => {
    if (role !== "admin") { showToast("仅管理员可清空"); return; }
    if (!confirm("确定清空服务端全部地点？此操作不可撤销。")) return;
    await api.clearAll(); showToast("已清空"); refresh();
  };
  const exportJson = async () => {
    const data = await api.getLocations();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "locations.json"; a.click();
    URL.revokeObjectURL(a.href); showToast("已导出 " + data.length + " 个地点");
  };

  const filtered = approved.filter(
    (l) => !filter || (l.name || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="app">
      <header className="topbar">
        <button className="menu-btn" onClick={() => setDrawerOpen((v) => !v)} aria-label="菜单">
          ☰
        </button>
        <span className="topbar-title">自定义地点世界地图</span>
        <span className={"badge " + (role === "admin" ? "admin" : "user")}>
          {role === "admin" ? "管理员" : "普通用户"}
        </span>
      </header>
      {drawerOpen && <div className="drawer-mask" onClick={() => setDrawerOpen(false)} />}
      <aside className={"sidebar" + (drawerOpen ? " open" : "")}>
        <div>
          <h1>自定义地点世界地图</h1>
          <div className="sub">搜索已知地点 → 设别名 → 上图（含审批）</div>
        </div>

        <div className="section">
          <div className="ttl">当前身份</div>
          <div className="rolebar">
            <span className={"badge " + (role === "admin" ? "admin" : "user")}>
              {role === "admin" ? "管理员" : "普通用户"}
            </span>
            <span style={{ flex: 1 }} />
            <button className="ghost" onClick={onRoleBtn}>
              {role === "admin" ? "退出登录" : "管理员登录"}
            </button>
          </div>
        </div>

        <div className="section">
          <div className="ttl">添加地点（搜索地球已知地点）</div>
          <input value={searchKw} onChange={onSearchChange} placeholder="搜索城市/地点，如 北京、Tokyo、Eiffel" />
          <div className="search-results">
            {searchResults.map((r, i) => (
              <div key={i} className="sres" onClick={() => openAlias(r)}>
                <div className="nm">{r.originalName}</div>
                <div className="mt">{r.originalAddr || ""}</div>
              </div>
            ))}
          </div>
          <div className="empty" style={{ marginTop: 8 }}>{searchHint}</div>
        </div>

        {role === "admin" && (
          <div className="section">
            <div className="ttl">管理员工具</div>
            <button
              className={"primary" + (adminAddMode ? " active" : "")}
              style={{ width: "100%", marginBottom: 12 }}
              onClick={() => setAdminAddMode(!adminAddMode)}
            >
              {adminAddMode ? "✓ 点击地图添加中" : "＋ 在地图任意位置添加"}
            </button>
            <div className="ttl">审批队列 <span className="badge warn">{pending.length}</span></div>
            <div className="appr-list">
              {pending.length === 0 && <div className="empty" style={{ marginTop: 6 }}>暂无待审批地点。</div>}
              {pending.map((l) => (
                <div key={l.id} className="appr-item">
                  <div className="info">
                    <div className="nm">{l.name}</div>
                    <div className="mt">
                      {(l.original_name || "") + (l.original_addr ? " · " + l.original_addr : "")} · {l.lat},{l.lng}
                    </div>
                  </div>
                  <div className="appr-actions">
                    <button className="ok" onClick={() => approve(l.id)}>通过</button>
                    <button className="bad" onClick={() => reject(l.id)}>拒绝</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="section">
          <div className="ttl">已显示地点 <span className="badge user">{approved.length}</span></div>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="筛选已显示地点" style={{ marginBottom: 8 }} />
          <div className="loc-list">
            {filtered.length === 0 && <div className="empty">没有匹配的已显示地点。</div>}
            {filtered.map((l) => (
              <div key={l.id} className="loc-item" onClick={() => openDetail(l.id)}>
                <span className="loc-dot" />
                <span className="loc-name">{l.name}</span>
                <span className="loc-meta">{l.lat}, {l.lng}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="ttl">数据</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ghost" onClick={exportJson}>导出已上图 JSON</button>
            <button className="badge" style={{ borderColor: "#6b2330", color: "#ff9aa6" }} onClick={clearAll}>清空全部</button>
          </div>
        </div>

        <div className="hint">
          说明：<br />
          • 普通用户：搜索已知地点 → 设置别名 → 提交后进入审批队列，管理员通过后上图。<br />
          • 管理员：可直接搜索添加，或在地图任意位置点击添加；并在「审批队列」中审核提交。<br />
          • 点击标记或左侧列表项查看详情（管理员可编辑/删除）。<br />
          • 数据存于 Cloudflare D1，多人/多设备共享。
        </div>
      </aside>

      <div className="map-wrap">
        <MapView
          approved={approved}
          pending={pending}
          role={role}
          adminAddMode={adminAddMode}
          onMarkerClick={openDetail}
          onMapClick={openAdd}
          onSearchResults={handleSearchResults}
          searchRef={searchRef}
        />
      </div>

      {modal && modal.type === "alias" && (
        <AliasModal data={modal.data} role={role} onConfirm={submitAlias} onCancel={() => setModal(null)} />
      )}
      {modal && modal.type === "add" && (
        <AddModal data={modal.data} onConfirm={submitAdd} onCancel={() => setModal(null)} />
      )}
      {modal && modal.type === "detail" && (
        <DetailModal loc={modal.data} role={role} onSave={saveDetail} onDelete={deleteDetail} onClose={() => setModal(null)} />
      )}

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </div>
  );
}

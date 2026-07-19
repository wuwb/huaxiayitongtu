import React, { useRef, useEffect } from "react";
import { BAIDU_AK } from "./config";

let baiduLoading = false;
let baiduCallbacks = [];

function loadBaidu(cb) {
  if (window.BMapGL) { cb(); return; }
  if (baiduLoading) { baiduCallbacks.push(cb); return; }
  baiduLoading = true;
  window.__mapInit = () => {
    baiduCallbacks.forEach((f) => f());
    baiduCallbacks = [];
  };
  const s = document.createElement("script");
  s.src =
    "https://api.map.baidu.com/api?v=3.0&type=webgl&ak=" +
    encodeURIComponent(BAIDU_AK) +
    "&callback=__mapInit";
  document.head.appendChild(s);
}

export default function MapView({
  approved, pending, role, adminAddMode, onMarkerClick, onMapClick, onSearchResults, searchRef,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { role, adminAddMode, onMapClick };

  // 初始化地图（仅一次）
  useEffect(() => {
    if (!BAIDU_AK || BAIDU_AK === "在此填写你的百度地图AK") return;
    loadBaidu(() => {
      if (mapRef.current) return;
      const map = new window.BMapGL.Map(containerRef.current);
      map.centerAndZoom(new window.BMapGL.Point(105, 35), 4);
      map.enableScrollWheelZoom(true);
      map.addControl(new window.BMapGL.NavigationControl());
      map.addControl(new window.BMapGL.ScaleControl());
      mapRef.current = map;

      const localSearch = new window.BMapGL.LocalSearch(map, {
        renderOptions: { map: null, autoViewport: false },
        onSearchComplete: () => onSearchResults && onSearchResults(localSearch.getResults()),
      });
      if (searchRef) searchRef.current = (kw) => localSearch.search(kw);

      map.addEventListener("click", (e) => {
        const s = stateRef.current;
        if (s.role === "admin" && s.adminAddMode && s.onMapClick) s.onMapClick(e.latlng);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 重新绘制标记
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.clearOverlays();
    const draw = (list, isPending) => {
      (list || []).forEach((loc) => {
        const pt = new window.BMapGL.Point(loc.lng, loc.lat);
        const mk = new window.BMapGL.Marker(pt);
        map.addOverlay(mk);
        const label = new window.BMapGL.Label(loc.name, { offset: new window.BMapGL.Size(12, -8) });
        if (isPending) label.addClass("pending");
        mk.setLabel(label);
        mk.addEventListener("click", (ev) => {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          onMarkerClick && onMarkerClick(loc.id);
        });
      });
    };
    draw(approved, false);
    if (role === "admin") draw(pending, true);
  }, [approved, pending, role, onMarkerClick]);

  if (!BAIDU_AK || BAIDU_AK === "在此填写你的百度地图AK") {
    return (
      <div className="map-notice">
        请在 <code>src/config.js</code> 顶部把 <code>BAIDU_AK</code> 替换成你的百度地图 AK，然后刷新。
        <br />AK 申请：lbsyun.baidu.com → 控制台 → 创建应用（启用「地图 JS API」）。
      </div>
    );
  }
  return <div id="map" ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

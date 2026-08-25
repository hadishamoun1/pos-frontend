import React, { useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./ShipmentTrackingMap.css";

// Real port coordinates [lat, lng]
const PORTS = {
  beirut: { name: "Beirut", pos: [33.8959, 35.5018] },
  trieste: { name: "Trieste", pos: [45.6495, 13.7768] },
  istanbul: { name: "Istanbul", pos: [41.0082, 28.9784] },
  shanghai: { name: "Shanghai / Qingdao", pos: [31.2304, 121.4737] },
  suez: { name: "Suez Canal", pos: [30.5852, 32.3486] },
};

const STATUS_COLOR = {
  good: "#2f7a5c",
  warn: "#a85a24",
  bad: "#ae4436",
  mute: "#8a99a3",
};

// Example shipments — illustrative only, not connected to a live tracking feed.
// "progress" (0..1) is a rough estimate of how far along the route the ship
// is, based on elapsed vs. total expected transit time — NOT real AIS position.
const SHIPMENTS = [
  {
    id: "shanghai",
    po: "PO-2026-0231",
    supplier: "Qingdao King Tai Glass Co.",
    carrier: "COSCO Shipping",
    vessel: "COSCO SHIPPING LEO",
    imo: "9784561",
    bl: "COSU6154872210",
    route: ["shanghai", "suez", "beirut"],
    status: "good",
    etaLabel: "ETA Aug 22 · 8 days out",
    metaLabel: "18.4 kn · hdg 262° · updated 3h ago",
    progress: 0.62,
  },
  {
    id: "istanbul",
    po: "PO-2026-0227",
    supplier: "Şişecam Trakya",
    carrier: "Arkas Line",
    vessel: "ARKAS BOSPHORUS",
    imo: "9812345",
    bl: "ARKS0093481",
    route: ["istanbul", "beirut"],
    status: "warn",
    etaLabel: "ETA Aug 15 · 1 day out",
    metaLabel: "15.8 kn · hdg 214° · updated 12m ago",
    progress: 0.85,
  },
  {
    id: "trieste",
    po: "PO-2026-0219",
    supplier: "Guardian Glass — Italy",
    carrier: "MSC",
    vessel: "MSC OSCAR",
    imo: "9703291",
    bl: "MEDUB3391207",
    route: ["trieste", "beirut"],
    status: "bad",
    etaLabel: "Due Aug 10 · 4 days overdue",
    metaLabel: "Anchored — customs hold at Beirut",
    progress: 1,
  },
  {
    id: "agc",
    po: "PO-2026-0233",
    supplier: "AGC Glass Europe",
    carrier: "CMA CGM",
    vessel: null,
    imo: null,
    bl: "CMAU7743210",
    route: ["shanghai", "beirut"],
    status: "mute",
    etaLabel: "Booked · sailing not yet started",
    metaLabel: null,
    progress: 0,
  },
];

const STATUS_LABEL = {
  good: "On schedule",
  warn: "Arriving soon",
  bad: "Overdue / held",
  mute: "Not yet shipped",
};

function interpolate(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function positionAlongRoute(routeKeys, progress) {
  const points = routeKeys.map((k) => PORTS[k].pos);
  if (points.length < 2) return points[0];
  const segCount = points.length - 1;
  const segLen = 1 / segCount;
  const segIdx = Math.min(segCount - 1, Math.floor(progress / segLen));
  const segT = (progress - segIdx * segLen) / segLen;
  return interpolate(points[segIdx], points[segIdx + 1], segT);
}

function shipIcon(status) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.mute;
  return L.divIcon({
    className: "ship-div-icon",
    html: `<div class="ship-div-icon-pin" style="background:${color}">🚢</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function FlyToOnSelect({ target }) {
  const map = useMap();
  React.useEffect(() => {
    if (target) map.flyTo(target, 5.5, { duration: 0.6 });
  }, [target, map]);
  return null;
}

export default function ShipmentTrackingMap() {
  const [selectedId, setSelectedId] = useState(null);
  const markerRefs = useRef({});

  const shipmentsWithPos = useMemo(
    () =>
      SHIPMENTS.map((s) => ({
        ...s,
        pos: s.progress > 0 ? positionAlongRoute(s.route, s.progress) : null,
      })),
    []
  );

  const selectedShipment = shipmentsWithPos.find((s) => s.id === selectedId) || null;
  const flyTarget = selectedShipment?.pos || null;

  const selectShipment = (id) => {
    setSelectedId((prev) => (prev === id ? null : id));
    const marker = markerRefs.current[id];
    if (marker) marker.openPopup();
  };

  return (
    <div className="ship-track-page">
      <div className="ship-track-banner">
        <strong>Concept preview</strong>
        <span>
          — example shipments with estimated positions (not live AIS data). Connect a tracking provider
          (e.g. ShipsGo) to replace these with real vessel positions.
        </span>
      </div>

      <div className="ship-track-header">
        <h1>Where Are Our Shipments</h1>
      </div>

      <div className="ship-track-grid">
        <div className="ship-track-map-wrap">
          <MapContainer
            center={[36, 25]}
            zoom={4}
            scrollWheelZoom={true}
            className="ship-track-leaflet"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {flyTarget && <FlyToOnSelect target={flyTarget} />}

            {shipmentsWithPos.map((s) => {
              const routePositions = s.route.map((k) => PORTS[k].pos);
              return (
                <React.Fragment key={s.id}>
                  <Polyline
                    positions={routePositions}
                    pathOptions={{
                      color: STATUS_COLOR[s.status],
                      weight: selectedId === s.id ? 4 : 2,
                      dashArray: s.status === "mute" ? "2 8" : "6 6",
                      opacity: selectedId && selectedId !== s.id ? 0.25 : 0.8,
                    }}
                  />
                  {s.pos && (
                    <Marker
                      position={s.pos}
                      icon={shipIcon(s.status)}
                      eventHandlers={{ click: () => selectShipment(s.id) }}
                      ref={(el) => {
                        if (el) markerRefs.current[s.id] = el;
                      }}
                    >
                      <Popup>
                        <div className="ship-popup">
                          <div className="ship-popup-po">{s.po}</div>
                          <div className="ship-popup-supplier">{s.supplier}</div>
                          {s.vessel && <div className="ship-popup-vessel">{s.vessel} {s.imo && `· IMO ${s.imo}`}</div>}
                          <div className="ship-popup-carrier">{s.carrier} · {s.bl}</div>
                          <div className={`ship-popup-eta ${s.status}`}>{s.etaLabel}</div>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </React.Fragment>
              );
            })}

            {Object.entries(PORTS).map(([key, p]) => (
              <Marker
                key={key}
                position={p.pos}
                icon={L.divIcon({
                  className: "port-div-icon",
                  html: `<div class="port-dot"></div><div class="port-label">${p.name}</div>`,
                  iconSize: [1, 1],
                  iconAnchor: [0, 0],
                })}
              />
            ))}
          </MapContainer>
        </div>

        <aside className="ship-track-list">
          <div className="ship-track-list-head">
            <h2>Shipments Overview</h2>
            <span className="ship-track-count">{SHIPMENTS.length} open</span>
          </div>
          <div className="ship-track-cards">
            {shipmentsWithPos.map((s) => (
              <article
                key={s.id}
                className={`ship-track-card${selectedId === s.id ? " selected" : ""}${s.status === "mute" ? " disabled" : ""}`}
                onClick={() => s.status !== "mute" && selectShipment(s.id)}
              >
                <div className="ship-track-card-top">
                  <div>
                    <div className="ship-track-po">{s.po}</div>
                    <p className="ship-track-supplier">{s.supplier}</p>
                  </div>
                  <span className={`ship-track-pill ${s.status}`}>{STATUS_LABEL[s.status]}</span>
                </div>
                <div className="ship-track-meta">{s.carrier} · <code>{s.bl}</code></div>
                <div className="ship-track-route">
                  {s.route.map((k) => PORTS[k].name).join(" → ")}
                </div>
                <div className={`ship-track-eta ${s.status}`}>{s.etaLabel}</div>
              </article>
            ))}
          </div>
        </aside>
      </div>

      <footer className="ship-track-footer">
        <strong>To make this real:</strong>
        <span> connect a tracking provider such as ShipsGo — it would replace the estimated positions above with real AIS-based vessel locations, using your existing carrier + BL number fields.</span>
      </footer>
    </div>
  );
}

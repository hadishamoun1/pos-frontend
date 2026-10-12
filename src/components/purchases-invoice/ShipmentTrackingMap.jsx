import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { axiosClient } from "../api/axiosClient";
import "./ShipmentTrackingMap.css";

const STATUS_COLOR = {
  good: "#16a34a",
  warn: "#d97706",
  bad: "#dc2626",
  mute: "#94a3b8",
};

const STATUS_LABEL = {
  good: "On schedule",
  warn: "Arriving soon",
  bad: "Overdue",
  mute: "Not sailing yet",
};

const STATUS_ORDER = ["good", "warn", "bad", "mute"];

// ShipsGo's ocean status enum -> our color key
const SHIPSGO_STATUS_BASE = {
  NEW: "mute",
  BOOKED: "mute",
  UNTRACKED: "mute",
  INPROGRESS: "good",
  LOADED: "good",
  SAILING: "good",
  ARRIVED: "good",
  DISCHARGED: "good",
};

function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

// Refine the base status into warn/bad based on how close/overdue the ETA is
// (only for shipments that are actually in transit, not yet-arrived/booked ones).
function statusKey(shipment) {
  if (shipment.source === "vessel") return vesselStatusKey(shipment);
  const base = SHIPSGO_STATUS_BASE[shipment.status] || "mute";
  if (base !== "good") return base;
  if (shipment.status === "ARRIVED" || shipment.status === "DISCHARGED") return "good";

  const disc = shipment?.route?.port_of_discharge;
  const etaISO = disc?.date_of_discharge_predicted || disc?.date_of_discharge;
  if (!etaISO) return "good";

  const diff = daysBetween(new Date(), new Date(etaISO));
  if (diff < 0) return "bad";
  if (diff <= 2) return "warn";
  return "good";
}

function etaLabel(shipment) {
  if (shipment.source === "vessel") return vesselEtaLabel(shipment);
  const disc = shipment?.route?.port_of_discharge;
  const etaISO = disc?.date_of_discharge_predicted || disc?.date_of_discharge || disc?.date_of_discharge_initial;

  if (shipment.status === "ARRIVED" || shipment.status === "DISCHARGED") {
    return etaISO
      ? `Arrived ${new Date(etaISO).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : "Arrived";
  }
  if (shipment.status === "NEW" || shipment.status === "BOOKED" || shipment.status === "UNTRACKED") {
    return "Booked · not sailing yet";
  }
  if (!etaISO) return "ETA unknown";

  const eta = new Date(etaISO);
  const dayLabel = eta.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const diff = daysBetween(new Date(), eta);

  if (diff < 0) return `Due ${dayLabel} · ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`;
  if (diff === 0) return `ETA ${dayLabel} · arriving today`;
  return `ETA ${dayLabel} · ${diff} day${diff === 1 ? "" : "s"} out`;
}

// AIS nav status codes we key off (mirrors the backend's NAV_STATUS) ->
// our shared good/warn/bad/mute buckets. Vessel-tracked (charter/bulk)
// shipments have no carrier ETA data at all, so this is coarser than the
// ShipsGo-based statusKey below — just "is it moving / stalled / unknown".
function vesselStatusKey(v) {
  if (v.vesselArrivedAtPort) return "good";
  if (v.vesselNavStatus === 0) return "good"; // under way using engine
  if (v.vesselNavStatus === 1 || v.vesselNavStatus === 5) return "warn"; // anchored/moored, not at a known port
  return "mute"; // no position yet
}

function vesselEtaLabel(v) {
  if (v.vesselArrivedAtPort) return `Arrived at ${v.vesselArrivedAtPort}`;
  if (v.vesselNavStatus === 0) {
    return v.vesselSpeedKnots != null ? `Under way · ${v.vesselSpeedKnots} kn` : "Under way";
  }
  if (v.vesselNavStatus === 1) return "At anchor";
  if (v.vesselNavStatus === 5) return "Moored";
  return "Position unknown";
}

// Normalizes a /purchase-invoices/vessel-links row into the same shape the
// rest of this page already renders shipments in, so the map/list/legend
// code doesn't need two separate render paths.
function vesselToShipment(v) {
  return {
    id: `vessel-${v.invoiceId}`,
    source: "vessel",
    reference: v.vesselName,
    booking_number: null,
    container_number: null,
    carrier: { name: v.vesselName },
    checked_at: v.lastCheckedAt,
    route: {
      port_of_loading: null,
      port_of_discharge: v.arrivedAtPort ? { location: { name: v.arrivedAtPort } } : null,
    },
    geo: {
      routePositions: [],
      portMarkers: [],
      currentPos: v.lat != null && v.lon != null ? [v.lat, v.lon] : null,
      vesselName: v.vesselName,
      vesselImo: v.vesselImo,
    },
    linkedInvoice: v.invoiceId
      ? {
          invoiceId: v.invoiceId,
          invoiceNumber: v.invoiceNumber,
          isOrderNumber: v.isOrderNumber,
          supplierName: v.supplierName,
          status: v.status,
        }
      : null,
    vesselNavStatus: v.navStatus,
    vesselSpeedKnots: v.speedKnots,
    vesselArrivedAtPort: v.arrivedAtPort,
  };
}

function timeAgo(rawTs) {
  if (!rawTs) return null;
  const then = new Date(String(rawTs).replace(" ", "T"));
  if (isNaN(then.getTime())) return null;
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Flip GeoJSON's [lng, lat] into Leaflet's [lat, lng], and pull out the route
// line, port waypoints, live vessel position, and vessel name from a
// shipment's /geojson response.
function transformGeoJson(geojson) {
  const features = geojson?.features || [];
  const routePositions = [];
  const portMarkers = [];
  let currentPos = null;
  let vesselName = null;
  let vesselImo = null;

  for (const f of features) {
    const geomType = f?.geometry?.type;
    if (geomType === "Point") {
      const [lng, lat] = f.geometry.coordinates || [];
      if (lat != null && lng != null) {
        portMarkers.push({
          pos: [lat, lng],
          name: f.properties?.location?.name || "",
          status: f.properties?.status,
        });
      }
    } else if (geomType === "LineString") {
      for (const [lng, lat] of f.geometry.coordinates || []) {
        routePositions.push([lat, lng]);
      }
      if (f.properties?.status === "CURRENT") {
        vesselName = f.properties?.vessel?.name || null;
        vesselImo = f.properties?.vessel?.imo || null;
        const cur = f.properties?.current?.coordinates;
        if (cur) currentPos = [cur[1], cur[0]];
      }
    }
  }

  return { routePositions, portMarkers, currentPos, vesselName, vesselImo };
}

function shipIcon(status, active) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.mute;
  return L.divIcon({
    className: "ship-div-icon",
    html: `<div class="ship-div-icon-pin${active ? " active" : ""}" style="background:${color}">🚢</div>`,
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

// Leaflet caches its container's pixel size at mount. If the layout above/
// around the map shifts afterward (header/footer content changing, async
// data pushing things around, fonts swapping in) Leaflet doesn't notice and
// keeps rendering at the stale size — the map looks shrunk/cut off until a
// manual window resize. Re-measure once after mount (and after a short
// delay for late layout settling) and on every window resize.
function InvalidateMapSizeOnLayoutChange() {
  const map = useMap();
  React.useEffect(() => {
    const invalidate = () => map.invalidateSize();
    invalidate();
    const t = setTimeout(invalidate, 300);
    window.addEventListener("resize", invalidate);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);
  return null;
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}

export default function ShipmentTrackingMap() {
  const [selectedId, setSelectedId] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // Recieved shipments are done — hide them by default so the map only
  // shows what's actually still in transit, rather than accumulating every
  // completed shipment forever.
  const [showCompleted, setShowCompleted] = useState(false);
  const markerRefs = useRef({});
  const cancelledRef = useRef(false);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data }, linksRes, vesselLinksRes] = await Promise.all([
        axiosClient.get("/shipsgo/shipments", { params: { take: 100 } }),
        // Best-effort — invoices not linking to this shipment yet (or the
        // user lacking purchases.view) shouldn't break the tracking page.
        axiosClient.get("/purchase-invoices/shipment-links").catch(() => ({ data: [] })),
        // Charter/bulk vessels tracked by AIS instead of a ShipsGo booking —
        // same best-effort fallback.
        axiosClient.get("/purchase-invoices/vessel-links").catch(() => ({ data: [] })),
      ]);
      const raw = data?.shipments || [];

      const linkByShipmentId = new Map(
        (linksRes.data || []).map((l) => [String(l.shipsgoShipmentId), l])
      );

      const withGeo = await Promise.all(
        raw.map(async (s) => {
          let geo = { routePositions: [], portMarkers: [], currentPos: null, vesselName: null, vesselImo: null };
          try {
            const geoRes = await axiosClient.get(`/shipsgo/shipments/${s.id}/geojson`);
            geo = transformGeoJson(geoRes.data?.geojson);
          } catch {
            // leave the empty defaults — this shipment just won't be plotted
          }
          return { ...s, geo, linkedInvoice: linkByShipmentId.get(String(s.id)) || null };
        })
      );

      const vesselShipments = (vesselLinksRes.data || []).map(vesselToShipment);

      if (!cancelledRef.current) setShipments([...withGeo, ...vesselShipments]);
    } catch (e) {
      if (!cancelledRef.current) {
        setError(e?.response?.data?.message || e.message || "Failed to load shipments from ShipsGo");
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    fetchShipments();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchShipments]);

  const searchTerm = search.trim().toLowerCase();
  const visibleShipments = useMemo(() => {
    if (showCompleted) return shipments;
    return shipments.filter((s) => s.linkedInvoice?.status !== "Recieved");
  }, [shipments, showCompleted]);

  const completedCount = shipments.length - visibleShipments.length;

  const searchedShipments = useMemo(() => {
    if (!searchTerm) return visibleShipments;
    return visibleShipments.filter((s) => {
      const haystack = [
        s.reference,
        s.booking_number,
        s.container_number,
        s.carrier?.name,
        s.route?.port_of_loading?.location?.name,
        s.route?.port_of_discharge?.location?.name,
        s.linkedInvoice?.invoiceNumber,
        s.linkedInvoice?.supplierName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [visibleShipments, searchTerm]);

  const counts = useMemo(() => {
    const c = { all: searchedShipments.length, good: 0, warn: 0, bad: 0, mute: 0 };
    for (const s of searchedShipments) c[statusKey(s)]++;
    return c;
  }, [searchedShipments]);

  const filteredShipments = useMemo(() => {
    if (statusFilter === "all") return searchedShipments;
    return searchedShipments.filter((s) => statusKey(s) === statusFilter);
  }, [searchedShipments, statusFilter]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const selectedShipment = shipments.find((s) => s.id === selectedId) || null;
  const flyTarget = selectedShipment?.geo?.currentPos || null;

  const selectShipment = (id) => {
    setSelectedId((prev) => (prev === id ? null : id));
    const marker = markerRefs.current[id];
    if (marker) marker.openPopup();
  };

  // De-duplicate port markers across shipments that share a port (e.g. many
  // shipments discharging at Beirut) so we don't stack identical dots.
  const portMarkers = [];
  const seenPorts = new Set();
  for (const s of filteredShipments) {
    for (const p of s.geo.portMarkers) {
      const key = `${p.pos[0].toFixed(2)},${p.pos[1].toFixed(2)}`;
      if (seenPorts.has(key)) continue;
      seenPorts.add(key);
      portMarkers.push(p);
    }
  }

  return (
    <div className="ship-track-page">
      <div className="ship-track-header">
        <div>
          <h1>Shipment Tracking</h1>
        </div>
      </div>

      <div className="ship-track-stats">
        {STATUS_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`ship-stat-tile ${key}${statusFilter === key ? " active" : ""}`}
            onClick={() => setStatusFilter((prev) => (prev === key ? "all" : key))}
            aria-pressed={statusFilter === key}
          >
            <span className="ship-stat-count">{counts[key] || 0}</span>
            <span className="ship-stat-label">{STATUS_LABEL[key]}</span>
          </button>
        ))}
      </div>

      <div className="ship-track-toolbar">
        <div className="ship-track-search">
          <SearchIcon />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, container, booking, or carrier…"
          />
          {search && (
            <button type="button" className="ship-track-search-clear" onClick={() => setSearch("")} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
        {statusFilter !== "all" && (
          <button type="button" className="ship-track-filter-pill" onClick={() => setStatusFilter("all")}>
            {STATUS_LABEL[statusFilter]} <span>×</span>
          </button>
        )}
        <button
          type="button"
          className={`ship-track-filter-pill${showCompleted ? " active" : ""}`}
          onClick={() => setShowCompleted((v) => !v)}
        >
          {showCompleted ? "Hide" : "Show"} completed
          {completedCount > 0 ? ` (${completedCount})` : ""}
        </button>
        <button type="button" className="ship-track-refresh" onClick={fetchShipments} disabled={loading}>
          <RefreshIcon />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="ship-track-grid">
        <div className="ship-track-map-wrap">
          <MapContainer center={[30, 60]} zoom={3} scrollWheelZoom={true} className="ship-track-leaflet">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <InvalidateMapSizeOnLayoutChange />
            {flyTarget && <FlyToOnSelect target={flyTarget} />}

            {filteredShipments.map((s) => {
              const status = statusKey(s);
              return (
                <React.Fragment key={s.id}>
                  {s.geo.routePositions.length > 1 && (
                    <Polyline
                      positions={s.geo.routePositions}
                      pathOptions={{
                        color: STATUS_COLOR[status],
                        weight: selectedId === s.id ? 4 : 2,
                        dashArray: status === "mute" ? "2 8" : "6 6",
                        opacity: selectedId && selectedId !== s.id ? 0.25 : 0.8,
                      }}
                    />
                  )}
                  {s.geo.currentPos && (
                    <Marker
                      position={s.geo.currentPos}
                      icon={shipIcon(status, selectedId === s.id)}
                      eventHandlers={{ click: () => selectShipment(s.id) }}
                      ref={(el) => {
                        if (el) markerRefs.current[s.id] = el;
                      }}
                    >
                      <Popup>
                        <div className="ship-popup">
                          {s.linkedInvoice ? (
                            <div className="ship-popup-linked-po">
                              {s.linkedInvoice.isOrderNumber ? "Order " : "PO "}
                              {s.linkedInvoice.invoiceNumber}
                            </div>
                          ) : (
                            <div className="ship-popup-po">
                              {s.reference || s.booking_number || s.container_number}
                            </div>
                          )}
                          {s.source !== "vessel" && s.carrier?.name && (
                            <div className="ship-popup-supplier">{s.carrier.name}</div>
                          )}
                          {s.geo.vesselName && (
                            <div className="ship-popup-vessel">
                              {s.geo.vesselName} {s.geo.vesselImo && `· IMO ${s.geo.vesselImo}`}
                            </div>
                          )}
                          <div className="ship-popup-carrier">
                            {s.source === "vessel"
                              ? "Chartered vessel · AIS tracking"
                              : `${s.booking_number || "—"} ${s.container_number ? `· ${s.container_number}` : ""}`}
                          </div>
                          <div className={`ship-popup-eta ${status}`}>{etaLabel(s)}</div>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </React.Fragment>
              );
            })}

            {portMarkers.map((p, i) => (
              <Marker
                key={`port-${i}`}
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

          <div className="ship-track-legend">
            {STATUS_ORDER.map((key) => (
              <div className="ship-track-legend-item" key={key}>
                <span className="ship-track-legend-dot" style={{ background: STATUS_COLOR[key] }} />
                {STATUS_LABEL[key]}
              </div>
            ))}
          </div>
        </div>

        <aside className="ship-track-list">
          <div className="ship-track-list-head">
            <h2>Shipments Overview</h2>
            <span className="ship-track-count">
              {filteredShipments.length}
              {filteredShipments.length !== shipments.length ? ` of ${shipments.length}` : ""} tracked
            </span>
          </div>
          <div className="ship-track-cards">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div className="ship-track-skeleton" key={i}>
                  <div className="sk-line sk-w60" />
                  <div className="sk-line sk-w40" />
                  <div className="sk-line sk-w80" />
                </div>
              ))}

            {!loading && error && (
              <div className="ship-track-empty ship-track-error">
                <div className="ship-track-empty-title">Couldn't load shipments</div>
                <p>{error}</p>
                <button type="button" className="ship-track-retry" onClick={fetchShipments}>
                  <RefreshIcon /> Try again
                </button>
              </div>
            )}

            {!loading && !error && shipments.length === 0 && (
              <div className="ship-track-empty">
                <div className="ship-track-empty-title">No shipments tracked yet</div>
                <p>Use "Track Shipment" or "Track Vessel" on a purchase invoice and it'll show up here.</p>
              </div>
            )}

            {!loading && !error && shipments.length > 0 && filteredShipments.length === 0 && (
              <div className="ship-track-empty">
                <div className="ship-track-empty-title">No shipments match your filters</div>
                <p>Try a different search term or clear the active filter.</p>
                <button type="button" className="ship-track-retry" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            )}

            {!loading &&
              !error &&
              filteredShipments.map((s) => {
                const status = statusKey(s);
                const originName = s.route?.port_of_loading?.location?.name;
                const destName = s.route?.port_of_discharge?.location?.name;
                const isMute = status === "mute";
                return (
                  <article
                    key={s.id}
                    className={`ship-track-card${selectedId === s.id ? " selected" : ""}${isMute ? " disabled" : ""}`}
                    onClick={() => !isMute && s.geo.currentPos && selectShipment(s.id)}
                    role={!isMute && s.geo.currentPos ? "button" : undefined}
                    tabIndex={!isMute && s.geo.currentPos ? 0 : undefined}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !isMute && s.geo.currentPos) {
                        e.preventDefault();
                        selectShipment(s.id);
                      }
                    }}
                  >
                    <div className="ship-track-card-top">
                      <div>
                        {s.linkedInvoice ? (
                          <div className="ship-track-po ship-track-po-linked">
                            {s.linkedInvoice.isOrderNumber ? "Order " : "PO "}
                            {s.linkedInvoice.invoiceNumber}
                          </div>
                        ) : (
                          <div className="ship-track-po">{s.reference || s.booking_number || s.container_number}</div>
                        )}
                        <p className="ship-track-supplier">
                          {s.linkedInvoice?.supplierName ||
                            (s.source === "vessel" ? null : s.carrier?.name) ||
                            "—"}
                        </p>
                      </div>
                      <span className={`ship-track-pill ${status}`}>{STATUS_LABEL[status]}</span>
                    </div>
                    <div className="ship-track-meta">
                      {s.source === "vessel"
                        ? `Vessel: ${s.geo.vesselName}${s.geo.vesselImo ? ` · IMO ${s.geo.vesselImo}` : ""}`
                        : `${s.booking_number || "—"} ${s.container_number ? `· ${s.container_number}` : ""}`}
                      {s.checked_at ? ` · updated ${timeAgo(s.checked_at)}` : ""}
                    </div>
                    {(originName || destName) && (
                      <div className="ship-track-route">
                        {originName || "?"} <span className="ship-track-route-arrow">→</span> {destName || "?"}
                      </div>
                    )}
                    <div className={`ship-track-eta ${status}`}>{etaLabel(s)}</div>
                  </article>
                );
              })}
          </div>
        </aside>
      </div>
    </div>
  );
}

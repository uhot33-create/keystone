import { useEffect, useRef } from "react";
import { decodePolyline } from "@/lib/walk-log/gpx";
import "leaflet/dist/leaflet.css";

export function TrackMap({ encoded }: { encoded: string | null }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node || !encoded) return;
    const points = decodePolyline(encoded);
    if (points.length < 2) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      const leaflet = L.default ?? L;
      const instance = leaflet.map(el.current, { scrollWheelZoom: false });
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
        })
        .addTo(instance);
      const color =
        getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() || "#2f3a32";
      const line = leaflet.polyline(points, { color, weight: 4, opacity: 0.9 }).addTo(instance);
      instance.fitBounds(line.getBounds(), { padding: [16, 16] });
      map = instance;
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [encoded]);

  if (!encoded) {
    return (
      <div className="grid h-64 place-items-center rounded-xl border border-border bg-surface-2 text-sm text-muted">
        この記録には軌跡がありません
      </div>
    );
  }

  return <div ref={el} className="h-64 w-full overflow-hidden rounded-xl border border-border bg-surface-2" />;
}

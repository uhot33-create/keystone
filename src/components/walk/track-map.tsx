import { useEffect, useRef } from "react";
import { decodePolyline, splitTrack } from "@/lib/walk-log/gpx";
import "leaflet/dist/leaflet.css";

export function TrackMap({ encoded, tracks }: { encoded?: string | null; tracks?: string[] }) {
  const el = useRef<HTMLDivElement>(null);
  const lines = (tracks ?? (encoded ? [encoded] : [])).filter((line) => line.length > 0);
  const key = lines.join("\n");

  useEffect(() => {
    const node = el.current;
    if (!node || lines.length === 0) return;
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
      const drawn = lines.flatMap((line) =>
        splitTrack(decodePolyline(line)).map((segment) => leaflet.polyline(segment, { color, weight: 4, opacity: 0.9 })),
      );
      if (drawn.length === 0) {
        instance.remove();
        return;
      }
      const group = leaflet.featureGroup(drawn).addTo(instance);
      instance.fitBounds(group.getBounds(), { padding: [16, 16] });
      map = instance;
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [key]);

  if (lines.length === 0) {
    return (
      <div className="grid h-64 place-items-center rounded-xl border border-border bg-surface-2 text-sm text-muted">
        この記録には軌跡がありません
      </div>
    );
  }

  return <div ref={el} className="h-64 w-full overflow-hidden rounded-xl border border-border bg-surface-2" />;
}

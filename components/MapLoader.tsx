"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so it only ever renders in the browser.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="map-canvas" aria-busy="true" />,
});

export default LeafletMap;

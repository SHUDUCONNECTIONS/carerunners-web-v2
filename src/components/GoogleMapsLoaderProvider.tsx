"use client";

import * as React from "react";
import { useJsApiLoader, type Libraries } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY } from "@/utils/googleMaps";

// A single, app-wide Google Maps script load — shared via context instead of
// each page mounting its own <LoadScript>. Multiple independent <LoadScript>
// instances mounting/unmounting as users navigate (request page, parts flow,
// trip tracking) is what caused the "works after a refresh, not the first
// time" bug: React Strict Mode's dev-mode double-invoke of effects conflicts
// with LoadScript's internal script-tag bookkeeping the first time any of
// them mounts in a session. Loading the script exactly once here avoids that
// entirely — everything else just reads `isLoaded`.
const LIBRARIES: Libraries = ["places"];

interface GoogleMapsLoaderContextValue {
  isLoaded: boolean;
  loadError?: Error;
}

const GoogleMapsLoaderContext = React.createContext<GoogleMapsLoaderContextValue>({ isLoaded: false });

export function GoogleMapsLoaderProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "carerunners-google-maps-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const value = React.useMemo(() => ({ isLoaded, loadError }), [isLoaded, loadError]);

  return <GoogleMapsLoaderContext.Provider value={value}>{children}</GoogleMapsLoaderContext.Provider>;
}

export function useGoogleMapsLoader(): GoogleMapsLoaderContextValue {
  return React.useContext(GoogleMapsLoaderContext);
}

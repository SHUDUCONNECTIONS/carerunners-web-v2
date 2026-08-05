"use client"

import { useEffect, useRef, useState } from "react"
import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api"
import { useGoogleMapsLoader } from "@/components/GoogleMapsLoaderProvider"

const mapContainerStyle = { width: "100%", height: "180px" }

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Live route preview for the driver dashboard: a moving "you are here" dot
// plus the road route to the next stop. Directions are only recomputed once
// the driver has moved ~75m (or the destination changes) — recalculating on
// every raw GPS tick would spam the Directions API for no visible benefit.
export default function DriverRouteMap({
  origin,
  destination,
  label,
}: {
  origin: { lat: number; lng: number }
  destination: string
  label: string
}) {
  const { isLoaded } = useGoogleMapsLoader()
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const lastComputedRef = useRef<{ origin: { lat: number; lng: number }; destination: string } | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    const last = lastComputedRef.current
    const moved = !last || last.destination !== destination || haversineMeters(last.origin, origin) > 75
    if (!moved) return
    lastComputedRef.current = { origin, destination }

    const service = new google.maps.DirectionsService()
    service.route(
      { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === "OK" && result) setDirections(result)
      }
    )
  }, [isLoaded, origin, destination])

  if (!isLoaded) {
    return (
      <div className="mt-4 h-[180px] rounded-xl bg-gray-100 animate-pulse flex items-center justify-center text-xs text-gray-400">
        Loading map…
      </div>
    )
  }

  const leg = directions?.routes?.[0]?.legs?.[0]
  const endLocation = leg?.end_location

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-gray-100">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={origin}
        zoom={14}
        options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative" }}
      >
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: { strokeColor: "#0d9488", strokeWeight: 5 },
            }}
          />
        )}
        <Marker
          position={origin}
          title="You"
          icon={{ url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
        />
        {endLocation && (
          <Marker position={{ lat: endLocation.lat(), lng: endLocation.lng() }} title={label} />
        )}
      </GoogleMap>
      {leg && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 text-xs text-gray-600">
          <span>To {label}</span>
          <span className="font-semibold text-teal-700">
            {leg.distance?.text} · {leg.duration?.text}
          </span>
        </div>
      )}
    </div>
  )
}

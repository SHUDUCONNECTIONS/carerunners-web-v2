"use client"

import React, { useRef } from "react"
import { Autocomplete } from "@react-google-maps/api"
import { Input } from "@/components/ui/input"
import { useGoogleMapsLoader } from "@/components/GoogleMapsLoaderProvider"

export interface PickedPlace {
  address: string
  lat: number
  lng: number
  /** Suburb/city only, safe to show publicly instead of the full address. */
  area: string
}

function areaFrom(place: google.maps.places.PlaceResult): string {
  const comps = place.address_components ?? []
  const find = (...types: string[]) => comps.find((c) => types.some((t) => c.types.includes(t)))?.long_name
  const suburb = find("sublocality", "sublocality_level_1", "neighborhood")
  const city = find("locality", "administrative_area_level_2")
  return [suburb, city].filter(Boolean).join(", ") || place.formatted_address || ""
}

// Google Places address search restricted to South Africa. `onChange` fires on
// every keystroke (so the text stays editable); `onPick` fires only when a
// suggestion is chosen, carrying the coordinates used for distance pricing.
export function AddressAutocomplete({
  id,
  value,
  onChange,
  onPick,
  placeholder,
  className,
  required,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  onPick?: (place: PickedPlace) => void
  placeholder?: string
  className?: string
  required?: boolean
}) {
  const { isLoaded, loadError } = useGoogleMapsLoader()
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  // Until Google Places is ready (or if it fails to load) this is a normal text
  // box, so a maps problem can never stop someone typing their address.
  if (!isLoaded || loadError) {
    return (
      <Input
        className={className ?? "text-base md:text-sm"}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    )
  }

  return (
    <Autocomplete
      onLoad={(a) => {
        autocompleteRef.current = a
        a.setComponentRestrictions({ country: "za" })
      }}
      onPlaceChanged={() => {
        const place = autocompleteRef.current?.getPlace()
        if (!place?.geometry?.location) return
        const address = place.formatted_address ?? value
        onChange(address)
        onPick?.({
          address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          area: areaFrom(place),
        })
      }}
    >
      <Input
        className={className ?? "text-base md:text-sm"}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </Autocomplete>
  )
}

// Shared Google Maps/Places project key — used for both the JS Maps SDK
// (LoadScript + Autocomplete + DistanceMatrixService/PlacesService) and
// stays the same across every screen that needs maps, so there's one place
// to rotate it.
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string;

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Autocomplete } from "@react-google-maps/api";
import {
  Package,
  Hash,
  ListOrdered,
  Banknote,
  Camera,
  Search,
  Store,
  MapPin,
  ArrowLeft,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { StepIndicator, StepNav } from "@/components/Stepper";
import { auth, db, rtdb, storage } from "@/utils/firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref as dbRef, set as dbSet } from "firebase/database";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useGoogleMapsLoader } from "@/components/GoogleMapsLoaderProvider";

const STEPS = ["Item Details", "Choose a Store", "Delivery Address", "Review"];

// Haversine straight-line distance — good enough for sorting/pricing; there's
// no real per-retailer pricing API to check against (same stub limitation
// the original PartRunner prototype had).
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Same base-fare formula the document flow uses (calculatePrice in
// request/page.tsx) — kept consistent rather than inventing a second one.
function deliveryFeeForDistance(km) {
  const basePrice = 32;
  const ratePerKm = 10;
  return km <= 1 ? basePrice : basePrice + (km - 1) * ratePerKm;
}

const SERVICE_FEE = 15;

export default function PartsRequestFlow({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const { isLoaded: mapsReady } = useGoogleMapsLoader();

  // Step 0 — item details
  const [itemName, setItemName] = useState("");
  const [vinNumber, setVinNumber] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [referencePrice, setReferencePrice] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Step 1 — choose a store
  const [locating, setLocating] = useState(false);
  const [storeError, setStoreError] = useState("");
  const [stores, setStores] = useState<any[]>([]);
  const [storeSearch, setStoreSearch] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // Step 2 — delivery address
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryAutocomplete, setDeliveryAutocomplete] = useState<any>(null);

  // Step 3 — review
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const loadStores = useCallback(() => {
    if (!mapsReady || typeof window === "undefined" || !window.google) return;
    setLocating(true);
    setStoreError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const service = new window.google.maps.places.PlacesService(document.createElement("div"));
        service.nearbySearch(
          {
            location: { lat: latitude, lng: longitude },
            radius: 8000,
            keyword: "auto parts store",
          },
          (results, status) => {
            setLocating(false);
            if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
              setStoreError("Could not find stores near you. Please try again.");
              setStores([]);
              return;
            }
            const nearby = results
              .filter((r) => r.geometry?.location)
              .map((r) => ({
                id: r.place_id,
                name: r.name,
                address: r.vicinity || "",
                lat: r.geometry.location.lat(),
                lng: r.geometry.location.lng(),
                distanceKm: distanceKm(latitude, longitude, r.geometry.location.lat(), r.geometry.location.lng()),
              }))
              .sort((a, b) => a.distanceKm - b.distanceKm);
            setStores(nearby);
          }
        );
      },
      () => {
        setLocating(false);
        setStoreError("Location permission is required to find stores near you.");
      }
    );
  }, [mapsReady]);

  useEffect(() => {
    if (currentStep === 1 && mapsReady && stores.length === 0 && !locating && !storeError) {
      loadStores();
    }
  }, [currentStep, mapsReady, stores.length, locating, storeError, loadStores]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const referencePriceNum = parseFloat(referencePrice) || 0;
  const selectedStore = stores.find((s) => s.id === selectedStoreId) || null;

  const deliveryDistanceKm = selectedStore && deliveryCoords
    ? distanceKm(selectedStore.lat, selectedStore.lng, deliveryCoords.lat, deliveryCoords.lng)
    : null;
  const deliveryFee = deliveryDistanceKm !== null ? deliveryFeeForDistance(deliveryDistanceKm) : null;
  const itemTotal = referencePriceNum * quantity;
  const grandTotal = deliveryFee !== null ? itemTotal + deliveryFee + SERVICE_FEE : null;

  const canProceed = () => {
    if (currentStep === 0) return itemName.trim().length > 0 && quantity > 0 && referencePriceNum > 0;
    if (currentStep === 1) return !!selectedStoreId;
    if (currentStep === 2) return !!deliveryAddress.trim() && !!deliveryCoords;
    if (currentStep === 3) return agreeToTerms;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    setCurrentStep((s) => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep !== STEPS.length - 1 || !canProceed() || !selectedStore || grandTotal === null) return;

    const user = auth.currentUser;
    if (!user) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      let partPhotoUrl: string | null = null;
      if (photo) {
        const photoRef = storageRef(storage, `partOrders/${user.uid}/${Date.now()}_${photo.name}`);
        const task = uploadBytesResumable(photoRef, photo);
        await new Promise<void>((resolve, reject) => {
          task.on("state_changed", undefined, reject, () => resolve());
        });
        partPhotoUrl = await getDownloadURL(task.snapshot.ref);
      }

      const today = new Date().toISOString().split("T")[0];
      const requestId = `${user.uid}_${Date.now()}`;
      const requestData = {
        userId: user.uid,
        serviceCategory: "parts",
        itemName: itemName.trim(),
        vinNumber: vinNumber.trim() || null,
        quantity,
        partPhotoUrl,
        store: {
          id: selectedStore.id,
          name: selectedStore.name,
          address: selectedStore.address,
          lat: selectedStore.lat,
          lng: selectedStore.lng,
          distanceKm: selectedStore.distanceKm,
        },
        pickupLocation: selectedStore.address,
        dropoffLocation: deliveryAddress,
        distance: deliveryDistanceKm!.toFixed(2),
        price: grandTotal.toFixed(2),
        itemTotal: itemTotal.toFixed(2),
        priceOverrun: null,
        hadDiscrepancy: false,
        pickupDate: today,
        pickupTime: "ASAP",
        status: "awaiting-payment",
        payment_status: "unpaid",
        createdAt: new Date(),
      };

      await setDoc(doc(db, "pickupRequests", requestId), requestData);
      await dbSet(dbRef(rtdb, `trips/${requestId}`), { ...requestData, createdAt: Date.now() });

      router.push(`/payment?requestId=${requestId}`);
    } catch (error) {
      console.error("Error saving parts request:", error);
      setSubmitError("Could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStores = stores.filter((s) => s.name.toLowerCase().includes(storeSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[var(--brand-700)] mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Change service
        </button>

        <div className="flex items-center gap-2 mb-4">
          <img src="/carerunnerlogo.png" alt="Carerunners" className="h-8 w-8 rounded-lg border border-gray-200" />
          <span className="text-gray-300 text-sm font-bold">×</span>
          <img
            src="/partrunnerlogo.png"
            alt="PartRunner"
            className="h-8 w-8 rounded-lg border border-gray-200 object-contain p-0.5"
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 ml-1">
            Carerunners × PartRunner
          </span>
        </div>

        <div className="mb-7">
          <h1 className="text-2xl font-bold text-gray-900">Request Auto Parts Delivery</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tell us what you need — we&apos;ll find it at a nearby store and deliver it to you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
            <StepIndicator steps={STEPS} currentStep={currentStep} />

            {/* ── Step 0: Item Details ── */}
            {currentStep === 0 && (
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Item Details</h2>
                <div className="h-px bg-gray-100 mb-5" />

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                      <Package className="h-4 w-4 text-gray-400" />
                      Part / Item Name
                    </Label>
                    <Input
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="e.g. Front brake pads"
                      className="h-11 rounded-xl border-gray-200 focus:ring-[var(--brand-500)] focus:border-[var(--brand-500)]"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                      <Hash className="h-4 w-4 text-gray-400" />
                      VIN Number
                      <span className="ml-auto text-xs font-normal text-gray-400">Optional</span>
                    </Label>
                    <Input
                      value={vinNumber}
                      onChange={(e) => setVinNumber(e.target.value)}
                      placeholder="If you have it"
                      className="h-11 rounded-xl border-gray-200 focus:ring-[var(--brand-500)] focus:border-[var(--brand-500)]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                        <ListOrdered className="h-4 w-4 text-gray-400" />
                        Quantity
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="h-11 rounded-xl border-gray-200 focus:ring-[var(--brand-500)] focus:border-[var(--brand-500)]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-gray-400" />
                        Expected Price (each)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={referencePrice}
                        onChange={(e) => setReferencePrice(e.target.value)}
                        placeholder="R"
                        className="h-11 rounded-xl border-gray-200 focus:ring-[var(--brand-500)] focus:border-[var(--brand-500)]"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                      <Camera className="h-4 w-4 text-gray-400" />
                      Photo
                      <span className="ml-auto text-xs font-normal text-gray-400">Optional</span>
                    </Label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl">
                      <div className="space-y-1 text-center">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Part preview" className="mx-auto h-24 rounded-lg object-cover" />
                        ) : (
                          <Camera className="mx-auto h-10 w-10 text-gray-400" />
                        )}
                        <div className="flex text-sm text-gray-600 justify-center">
                          <label
                            htmlFor="part-photo"
                            className="relative cursor-pointer font-medium text-[var(--brand-600)] hover:text-[var(--brand-500)]"
                          >
                            <span>{photoPreview ? "Change photo" : "Attach a photo"}</span>
                            <input
                              id="part-photo"
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={handlePhotoChange}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── Step 1: Choose a Store ── */}
            {currentStep === 1 && (
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Choose a Store</h2>
                <div className="h-px bg-gray-100 mb-5" />

                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 mb-4">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder="Search stores…"
                    className="flex-1 py-2.5 text-sm outline-none bg-transparent"
                  />
                </div>

                {!mapsReady && (
                  <div className="flex flex-col items-center gap-2 py-10 text-gray-500 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-600)]" />
                    Loading maps…
                  </div>
                )}

                {mapsReady && locating && (
                  <div className="flex flex-col items-center gap-2 py-10 text-gray-500 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-600)]" />
                    Finding auto parts stores near you…
                  </div>
                )}

                {mapsReady && !locating && !!storeError && (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-700">{storeError}</p>
                    <Button type="button" variant="outline" className="rounded-xl mt-1" onClick={loadStores}>
                      Try again
                    </Button>
                  </div>
                )}

                {mapsReady && !locating && !storeError && filteredStores.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-10">No auto parts stores found nearby.</p>
                )}

                {mapsReady && !locating && !storeError && filteredStores.length > 0 && (
                  <div className="space-y-3">
                    {filteredStores.map((s) => {
                      const active = selectedStoreId === s.id;
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => setSelectedStoreId(s.id)}
                          className={`w-full text-left flex items-center gap-3 p-3.5 rounded-2xl border transition-colors ${
                            active ? "border-[var(--brand-500)] bg-[var(--brand-50)]" : "border-gray-100 hover:border-gray-200"
                          }`}
                        >
                          <div
                            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                              active ? "bg-[var(--brand-600)]" : "bg-[var(--brand-50)]"
                            }`}
                          >
                            <Store className={`h-5 w-5 ${active ? "text-white" : "text-[var(--brand-600)]"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {s.address} · {s.distanceKm.toFixed(1)} km
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ── Step 2: Delivery Address ── */}
            {currentStep === 2 && (
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Delivery Address</h2>
                <div className="h-px bg-gray-100 mb-5" />

                <Label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[var(--brand-500)]" />
                  Where should we deliver it?
                </Label>
                {mapsReady ? (
                  <Autocomplete
                    onLoad={(autocomplete) => {
                      setDeliveryAutocomplete(autocomplete);
                      autocomplete.setComponentRestrictions({ country: "za" });
                    }}
                    onPlaceChanged={() => {
                      if (deliveryAutocomplete) {
                        const place = deliveryAutocomplete.getPlace();
                        if (place.geometry) {
                          setDeliveryCoords({
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng(),
                          });
                          setDeliveryAddress(place.formatted_address);
                        }
                      }
                    }}
                  >
                    <Input
                      value={deliveryAddress}
                      onChange={(e) => {
                        setDeliveryAddress(e.target.value);
                        setDeliveryCoords(null);
                      }}
                      placeholder="Search delivery address…"
                      className="h-11 rounded-xl border-gray-200 focus:ring-[var(--brand-500)] focus:border-[var(--brand-500)]"
                    />
                  </Autocomplete>
                ) : (
                  <Input
                    disabled
                    placeholder="Loading maps…"
                    className="h-11 rounded-xl border-gray-200"
                  />
                )}
                {deliveryAddress && !deliveryCoords && (
                  <p className="text-xs text-amber-600 mt-2">Please select an address from the suggestions.</p>
                )}
              </section>
            )}

            {/* ── Step 3: Review ── */}
            {currentStep === 3 && selectedStore && (
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Review &amp; Confirm</h2>
                <div className="h-px bg-gray-100 mb-5" />

                <div className="space-y-3 text-sm mb-5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Item</span>
                    <span className="font-medium text-gray-900">
                      {itemName} × {quantity}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Store</span>
                    <span className="font-medium text-gray-900">{selectedStore.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Delivery to</span>
                    <span className="font-medium text-gray-900 text-right max-w-[60%]">{deliveryAddress}</span>
                  </div>
                  <div className="h-px bg-gray-100 my-2" />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Item total</span>
                    <span className="text-gray-900">R{itemTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Delivery fee ({deliveryDistanceKm?.toFixed(1)} km)</span>
                    <span className="text-gray-900">R{deliveryFee?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Service fee</span>
                    <span className="text-gray-900">R{SERVICE_FEE.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span className="text-gray-900">Total</span>
                    <span className="text-[var(--brand-700)]">R{grandTotal?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="agreeToTermsParts"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                    className="mt-0.5 data-[state=checked]:bg-[var(--brand-600)] data-[state=checked]:border-[var(--brand-600)]"
                  />
                  <Label htmlFor="agreeToTermsParts" className="text-sm font-medium text-gray-700 cursor-pointer">
                    I agree to the{" "}
                    <span className="text-[var(--brand-600)] underline underline-offset-2">terms and conditions</span>
                  </Label>
                </div>

                {!!submitError && <p className="text-xs text-red-500 mt-3">{submitError}</p>}
              </section>
            )}

            <StepNav
              currentStep={currentStep}
              totalSteps={STEPS.length}
              onBack={() => setCurrentStep((s) => s - 1)}
              onNext={handleNext}
              isLastStep={currentStep === STEPS.length - 1}
              submitLabel="Submit Request"
              loading={submitting}
              nextDisabled={!canProceed()}
            />
          </form>
      </main>
    </div>
  );
}

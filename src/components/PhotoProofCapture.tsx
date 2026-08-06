"use client";

import React, { useState } from "react";
import { Camera, X, Loader2, CheckCircle2 } from "lucide-react";
import { storage, db } from "@/utils/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { TripStatus } from "@/lib/tripStatus";

interface PhotoProofCaptureProps {
  tripId: string;
  proofKind: "pickup" | "delivery";
  nextStatus: TripStatus;
  label: string;
  disabled?: boolean;
  onDone?: () => void;
}

// Driver-facing "mark picked up / delivered" action, but gated on attaching a
// photo first — status only advances once the photo has uploaded and the
// Firestore doc has been updated, so there's no way to skip proof of
// collection/delivery.
export function PhotoProofCapture({ tripId, proofKind, nextStatus, label, disabled, onDone }: PhotoProofCaptureProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setError("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleConfirm = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const storageRef = ref(storage, `tripProofs/${tripId}/${proofKind}.jpg`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on("state_changed", undefined, reject, () => resolve());
      });

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

      const urlField = proofKind === "pickup" ? "pickupProofUrl" : "deliveryProofUrl";
      const atField = proofKind === "pickup" ? "pickupProofAt" : "deliveryProofAt";

      await updateDoc(doc(db, "pickupRequests", tripId), {
        status: nextStatus,
        [urlField]: downloadURL,
        [atField]: new Date(),
      });

      handleClose();
      onDone?.();
    } catch (err) {
      console.error("Error uploading proof photo:", err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-sm rounded-xl py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Camera className="h-4 w-4" />
        {label}
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          {proofKind === "pickup" ? "Photo proof of collection" : "Photo proof of delivery"}
        </p>
        <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Proof preview" className="w-full h-40 object-cover rounded-lg border border-gray-200" />
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed border-gray-300 bg-white cursor-pointer text-gray-400 hover:border-teal-400 hover:text-teal-500 transition-colors">
          <Camera className="h-6 w-6" />
          <span className="text-xs font-medium">Tap to take or choose a photo</span>
          <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        </label>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!file || uploading}
        className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-sm rounded-xl py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Confirm &amp; Upload Photo
          </>
        )}
      </button>
    </div>
  );
}

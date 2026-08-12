"use client";

import React from "react";
import Image from "next/image";
import { VEHICLE_TYPE_LIST, VehicleType } from "@/lib/services";

interface VehiclePickerProps {
  value: VehicleType | "";
  onChange: (value: VehicleType) => void;
}

export function VehiclePicker({ value, onChange }: VehiclePickerProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {VEHICLE_TYPE_LIST.map((vehicle) => {
        const selected = value === vehicle.id;
        return (
          <button
            key={vehicle.id}
            type="button"
            onClick={() => onChange(vehicle.id)}
            aria-pressed={selected}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2 ${
              selected
                ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                : "border-gray-200 bg-white hover:border-teal-300"
            }`}
          >
            <span
              className={`relative flex h-14 w-full items-center justify-center overflow-hidden rounded-lg ${
                selected ? "ring-1 ring-teal-500" : ""
              }`}
            >
              <Image src={vehicle.image} alt={vehicle.label} fill className="object-cover" sizes="120px" />
            </span>
            <span className="text-xs font-semibold text-gray-800 text-center leading-tight">{vehicle.label}</span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import React from "react";
import { VEHICLE_TYPE_LIST, VehicleType } from "@/lib/services";

interface VehiclePickerProps {
  value: VehicleType | "";
  onChange: (value: VehicleType) => void;
}

export function VehiclePicker({ value, onChange }: VehiclePickerProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {VEHICLE_TYPE_LIST.map((vehicle) => {
        const Icon = vehicle.icon;
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
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                selected ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold text-gray-800 text-center leading-tight">{vehicle.label}</span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import React from "react";
import { SERVICE_TYPE_LIST, ServiceType } from "@/lib/services";

interface ServiceCategoryPickerProps {
  value: ServiceType | "";
  onChange: (value: ServiceType) => void;
}

export function ServiceCategoryPicker({ value, onChange }: ServiceCategoryPickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {SERVICE_TYPE_LIST.map((service) => {
        const Icon = service.icon;
        const selected = value === service.id;
        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onChange(service.id)}
            aria-pressed={selected}
            className={`text-left rounded-xl border p-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2 ${
              selected
                ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                : "border-gray-200 bg-white hover:border-teal-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  selected ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{service.label}</p>
                <p className="text-gray-500 text-xs mt-1 leading-snug">{service.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import * as React from "react";

// Which service the customer is currently in — drives the brand color
// (teal for Carerunners, PartRunner red for Auto Parts Delivery) via the
// --brand-* CSS variables in globals.css. Separate from the light/dark
// ThemeProvider, which is an unrelated concern.
//
// Deliberately NOT persisted (no localStorage, no route-based lookup) —
// it always starts on "carerunners" and only flips to "partrunner" while
// the Auto Parts Delivery flow is actually mounted (see request/page.tsx),
// which resets it back on unmount. That keeps the PartRunner theme scoped
// to that flow instead of leaking into the rest of the app after a reload
// or a navigation elsewhere.
export type ServiceBrand = "carerunners" | "partrunner";

interface ServiceBrandContextValue {
  brand: ServiceBrand;
  setBrand: (brand: ServiceBrand) => void;
}

const ServiceBrandContext = React.createContext<ServiceBrandContextValue | undefined>(undefined);

export function ServiceBrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrandState] = React.useState<ServiceBrand>("carerunners");

  React.useEffect(() => {
    document.documentElement.setAttribute("data-service-brand", brand);
  }, [brand]);

  const setBrand = React.useCallback((next: ServiceBrand) => {
    setBrandState(next);
  }, []);

  const value = React.useMemo<ServiceBrandContextValue>(() => ({ brand, setBrand }), [brand, setBrand]);

  return <ServiceBrandContext.Provider value={value}>{children}</ServiceBrandContext.Provider>;
}

export function useServiceBrand(): ServiceBrandContextValue {
  const context = React.useContext(ServiceBrandContext);
  if (!context) {
    throw new Error("useServiceBrand must be used within a ServiceBrandProvider");
  }
  return context;
}

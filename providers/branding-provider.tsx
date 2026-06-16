'use client';

import { createContext, useContext } from 'react';
import { Branding } from '@/lib/db/schema';

interface BrandingContextType {
  branding: Branding | null | undefined;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({
  children,
  branding,
}: {
  children: React.ReactNode;
  branding: Branding | null | undefined;
}) {
  return (
    <BrandingContext.Provider value={{ branding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}

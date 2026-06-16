
import { ReactNode } from 'react';

export default function BrandingLayout({ children }: { children: ReactNode }) {
  return <div className="h-full">{children}</div>;
}


import { BrandingForm } from "./BrandingForm";
import { db } from "@/lib/db/drizzle";
import { branding } from "@/lib/db/schema";

export default async function BrandingPage() {
  const brandingData = await db.query.branding.findFirst();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Branding</h1>
      <p className="text-gray-500">Customize your SaaS branding.</p>
      <div className="mt-6">
        <BrandingForm branding={brandingData} />
      </div>
    </div>
  );
}

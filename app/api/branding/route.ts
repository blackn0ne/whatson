import { getBranding } from '@/lib/db/queries/branding';

export async function GET() {
  const branding = await getBranding();
  return Response.json(branding || { name: 'WhatsSaaS', logoUrl: null, faviconUrl: null });
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { updateBranding } from './branding-actions';
import { Branding } from '@/lib/db/schema';
import Image from 'next/image';

const brandingFormSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  logo: z.any(),
  favicon: z.any(),
});

type BrandingFormValues = z.infer<typeof brandingFormSchema>;

interface BrandingFormProps {
  branding: Branding | null | undefined;
}

export function BrandingForm({ branding }: BrandingFormProps) {
  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: {
      name: branding?.name || '',
      logo: null,
      favicon: null,
    },
  });

  async function onSubmit(data: BrandingFormValues) {
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.logo[0]) {
      formData.append('logo', data.logo[0]);
    }
    if (data.favicon[0]) {
      formData.append('favicon', data.favicon[0]);
    }

    const result = await updateBranding(formData);

    if (result.success) {
      toast.success('Branding updated', {
        description: 'Your branding has been updated successfully.',
      });
    } else {
      toast.error('Error', {
        description: result.message,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SaaS Name</FormLabel>
              <FormControl>
                <Input placeholder="Your SaaS Name" {...field} />
              </FormControl>
              <FormDescription>
                This is the name of your SaaS that will be displayed throughout the application.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="logo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo</FormLabel>
              {branding?.logoUrl && (
                <div className="my-4">
                  <Image
                    src={branding.logoUrl}
                    alt="Current Logo"
                    width={100}
                    height={100}
                    className="rounded-md"
                  />
                </div>
              )}
              <FormControl>
                <Input
                  type="file"
                  onChange={(e) => field.onChange(e.target.files)}
                />
              </FormControl>
              <FormDescription>
                Upload a logo for your SaaS.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="favicon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Favicon</FormLabel>
              {branding?.faviconUrl && (
                <div className="my-4">
                  <Image
                    src={branding.faviconUrl}
                    alt="Current Favicon"
                    width={32}
                    height={32}
                    className="rounded-md"
                  />
                </div>
              )}
              <FormControl>
                <Input
                  type="file"
                  onChange={(e) => field.onChange(e.target.files)}
                />
              </FormControl>
              <FormDescription>
                Upload a favicon for your SaaS.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Update Branding</Button>
      </form>
    </Form>
  );
}

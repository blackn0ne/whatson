'use server';

import { z } from 'zod';
import { Resend } from 'resend';
import { getBranding } from '@/lib/db/queries/branding';

const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export type ContactActionState = {
  success?: string;
  error?: string;
};

export async function sendContactMessage(prevState: ContactActionState, formData: FormData): Promise<ContactActionState> {
  const branding = await getBranding();
  const siteName = branding?.name || 'WhatSaaS';
  
  const rawData = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string,
    subject: formData.get('subject') as string,
    message: formData.get('message') as string,
  };

  const validated = contactSchema.safeParse(rawData);

  if (!validated.success) {
    return {
      error: validated.error.issues[0].message,
    };
  }

  const { firstName, lastName, email, subject, message } = validated.data;

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: `${siteName} Contact <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: process.env.SUPPORT_EMAIL || 'delivered@resend.dev',
      replyTo: email,
      subject: `[Contact Form] ${subject}`,
      html: `
        <h3>New Contact Message</h3>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `
    });

    return { success: "Message sent successfully! We'll get back to you soon." };

  } catch (error) {
    console.error(error);
    return { error: "Failed to send message. Please try again later." };
  }
}
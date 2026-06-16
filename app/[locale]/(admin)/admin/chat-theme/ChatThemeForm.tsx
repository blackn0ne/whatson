'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Check, Loader2, ImageIcon, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { updateChatTheme, removeBackgroundImage } from './chat-theme-actions';
import type { ChatTheme } from '@/lib/db/schema';

interface ThemeVariant {
  backgroundColor: string;
  userBubbleColor: string;
  contactBubbleColor: string;
}

interface PresetTheme {
  nameKey: string;
  light: ThemeVariant;
  dark: ThemeVariant;
}

const PRESET_THEMES: PresetTheme[] = [
  {
    nameKey: 'theme_default',
    light: { backgroundColor: '#F4F4F5', userBubbleColor: '#E2EDE4', contactBubbleColor: '#FFFFFF' },
    dark: { backgroundColor: '#27272A', userBubbleColor: '#2A352E', contactBubbleColor: '#18181B' },
  },
  {
    nameKey: 'theme_whatsapp_classic',
    light: { backgroundColor: '#e5ddd5', userBubbleColor: '#dcf8c6', contactBubbleColor: '#ffffff' },
    dark: { backgroundColor: '#0b141a', userBubbleColor: '#005c4b', contactBubbleColor: '#202c33' },
  },
  {
    nameKey: 'theme_purple_night',
    light: { backgroundColor: '#f3e8ff', userBubbleColor: '#c4b5fd', contactBubbleColor: '#ffffff' },
    dark: { backgroundColor: '#1a1025', userBubbleColor: '#5b21b6', contactBubbleColor: '#2d2040' },
  },
  {
    nameKey: 'theme_rose',
    light: { backgroundColor: '#fff1f2', userBubbleColor: '#fda4af', contactBubbleColor: '#ffffff' },
    dark: { backgroundColor: '#1a1015', userBubbleColor: '#9d174d', contactBubbleColor: '#2d1a25' },
  },
  {
    nameKey: 'theme_orange_warm',
    light: { backgroundColor: '#fff7ed', userBubbleColor: '#fed7aa', contactBubbleColor: '#ffffff' },
    dark: { backgroundColor: '#1c1210', userBubbleColor: '#c2410c', contactBubbleColor: '#292018' },
  },
  {
    nameKey: 'theme_teal_fresh',
    light: { backgroundColor: '#f0fdfa', userBubbleColor: '#99f6e4', contactBubbleColor: '#ffffff' },
    dark: { backgroundColor: '#0d1b1a', userBubbleColor: '#0f766e', contactBubbleColor: '#1a2e2d' },
  },
  {
    nameKey: 'theme_blue_ocean',
    light: { backgroundColor: '#eff6ff', userBubbleColor: '#bfdbfe', contactBubbleColor: '#ffffff' },
    dark: { backgroundColor: '#0c1525', userBubbleColor: '#1d4ed8', contactBubbleColor: '#1a2540' },
  },
  {
    nameKey: 'theme_dark_green',
    light: { backgroundColor: '#ecfdf5', userBubbleColor: '#a7f3d0', contactBubbleColor: '#ffffff' },
    dark: { backgroundColor: '#071a12', userBubbleColor: '#166534', contactBubbleColor: '#14291e' },
  },
];

interface ChatThemeFormProps {
  theme: ChatTheme | null;
}

export function ChatThemeForm({ theme }: ChatThemeFormProps) {
  const { resolvedTheme } = useTheme();
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>(resolvedTheme === 'dark' ? 'dark' : 'light');
  const isDark = previewMode === 'dark';
  const t = useTranslations('ChatTheme');

  const [lightBg, setLightBg] = useState(theme?.backgroundColor || '#F4F4F5');
  const [lightUserBubble, setLightUserBubble] = useState(theme?.userBubbleColor || '#E2EDE4');
  const [lightContactBubble, setLightContactBubble] = useState(theme?.contactBubbleColor || '#FFFFFF');

  const [darkBg, setDarkBg] = useState(theme?.darkBackgroundColor || '#27272A');
  const [darkUserBubble, setDarkUserBubble] = useState(theme?.darkUserBubbleColor || '#2A352E');
  const [darkContactBubble, setDarkContactBubble] = useState(theme?.darkContactBubbleColor || '#18181B');

  const [backgroundType, setBackgroundType] = useState(theme?.backgroundType || 'solid');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(theme?.backgroundImageUrl || null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeBg = isDark ? darkBg : lightBg;
  const activeUserBubble = isDark ? darkUserBubble : lightUserBubble;
  const activeContactBubble = isDark ? darkContactBubble : lightContactBubble;

  const setActiveBg = isDark ? setDarkBg : setLightBg;
  const setActiveUserBubble = isDark ? setDarkUserBubble : setLightUserBubble;
  const setActiveContactBubble = isDark ? setDarkContactBubble : setLightContactBubble;

  const visibleThemes = useMemo(() => {
    return PRESET_THEMES.map((preset) => ({
      nameKey: preset.nameKey,
      variant: isDark ? preset.dark : preset.light,
    }));
  }, [isDark]);

  const applyPreset = (preset: PresetTheme) => {
    setLightBg(preset.light.backgroundColor);
    setLightUserBubble(preset.light.userBubbleColor);
    setLightContactBubble(preset.light.contactBubbleColor);
    setDarkBg(preset.dark.backgroundColor);
    setDarkUserBubble(preset.dark.userBubbleColor);
    setDarkContactBubble(preset.dark.contactBubbleColor);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('image_error'));
      return;
    }
    setImageFile(file);
    setBackgroundType('image');
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
  };

  const handleRemoveImage = async () => {
    setImageFile(null);
    setImagePreview(null);
    setBackgroundType('solid');
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (theme?.backgroundImageUrl) {
      const result = await removeBackgroundImage();
      if (result.success) {
        toast.success(t('image_removed'));
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set('backgroundType', backgroundType);
      formData.set('backgroundColor', lightBg);
      formData.set('userBubbleColor', lightUserBubble);
      formData.set('contactBubbleColor', lightContactBubble);
      formData.set('darkBackgroundColor', darkBg);
      formData.set('darkUserBubbleColor', darkUserBubble);
      formData.set('darkContactBubbleColor', darkContactBubble);
      if (imageFile) {
        formData.set('backgroundImage', imageFile);
      }

      const result = await updateChatTheme(formData);
      if (result.success) {
        toast.success(t('success_msg'));
      } else {
        toast.error(result.message || t('error_msg'));
      }
    } catch {
      toast.error(t('error_generic'));
    } finally {
      setSaving(false);
    }
  };

  const isLightColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('themes_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="inline-flex rounded-lg border p-1 bg-muted/50">
              <button
                onClick={() => setPreviewMode('light')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  !isDark ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sun className="h-4 w-4" />
                Light
              </button>
              <button
                onClick={() => setPreviewMode('dark')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isDark ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Moon className="h-4 w-4" />
                Dark
              </button>
            </div>
            <span className="text-sm text-muted-foreground">
              {isDark ? t('viewing_dark') : t('viewing_light')}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {visibleThemes.map(({ nameKey, variant }) => {
              const isActive =
                activeBg === variant.backgroundColor &&
                activeUserBubble === variant.userBubbleColor &&
                activeContactBubble === variant.contactBubbleColor;

              const preset = PRESET_THEMES.find((p) => p.nameKey === nameKey)!;

              return (
                <button
                  key={nameKey}
                  onClick={() => applyPreset(preset)}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${
                    isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                  }`}
                >
                  <div
                    className="aspect-[3/4] p-3 flex flex-col justify-end gap-2"
                    style={{ backgroundColor: variant.backgroundColor }}
                  >
                    <div
                      className="self-start rounded-lg px-3 py-2 text-xs max-w-[80%] shadow-sm"
                      style={{
                        backgroundColor: variant.contactBubbleColor,
                        color: isLightColor(variant.contactBubbleColor) ? '#333' : '#fff',
                      }}
                    >
                      Hello!
                    </div>
                    <div
                      className="self-end rounded-lg px-3 py-2 text-xs max-w-[80%] shadow-sm"
                      style={{
                        backgroundColor: variant.userBubbleColor,
                        color: isLightColor(variant.userBubbleColor) ? '#333' : '#fff',
                      }}
                    >
                      Hi there!
                    </div>
                  </div>
                  <div className="p-2 bg-card text-center">
                    <span className="text-xs font-medium">{t(nameKey)}</span>
                  </div>
                  {isActive && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t('custom_colors_title')}
            <span className="text-sm font-normal text-muted-foreground flex items-center gap-1">
              {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {isDark ? t('editing_dark') : t('editing_light')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>{t('background_color')}</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={activeBg}
                  onChange={(e) => setActiveBg(e.target.value)}
                  className="h-10 w-14 rounded cursor-pointer border"
                />
                <Input
                  value={activeBg}
                  onChange={(e) => setActiveBg(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('user_bubble')}</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={activeUserBubble}
                  onChange={(e) => setActiveUserBubble(e.target.value)}
                  className="h-10 w-14 rounded cursor-pointer border"
                />
                <Input
                  value={activeUserBubble}
                  onChange={(e) => setActiveUserBubble(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('contact_bubble')}</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={activeContactBubble}
                  onChange={(e) => setActiveContactBubble(e.target.value)}
                  className="h-10 w-14 rounded cursor-pointer border"
                />
                <Input
                  value={activeContactBubble}
                  onChange={(e) => setActiveContactBubble(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('background_image_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {t('background_image_desc')}
          </p>
          {imagePreview ? (
            <div className="relative inline-block">
              <div
                className="w-64 h-40 rounded-lg border overflow-hidden"
                style={{
                  backgroundImage: `url(${imagePreview})`,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '200px',
                }}
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-7 w-7 rounded-full"
                onClick={handleRemoveImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-64 h-40 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">{t('upload_pattern')}</span>
              <span className="text-xs text-muted-foreground/70 mt-1">{t('upload_hint')}</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('preview_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg overflow-hidden border h-80 flex flex-col justify-end p-4 gap-2"
            style={{
              backgroundColor: activeBg,
              ...(backgroundType === 'image' && imagePreview
                ? {
                    backgroundImage: `url(${imagePreview})`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '200px',
                  }
                : {}),
            }}
          >
            <div
              className="self-start rounded-lg px-3 py-2 text-sm max-w-[60%] shadow-sm"
              style={{
                backgroundColor: activeContactBubble,
                color: isLightColor(activeContactBubble) ? '#333' : '#fff',
              }}
            >
              <p>{t('preview_msg_1')}</p>
              <p className="text-[10px] opacity-60 text-right mt-1">10:30</p>
            </div>
            <div
              className="self-end rounded-lg px-3 py-2 text-sm max-w-[60%] shadow-sm"
              style={{
                backgroundColor: activeUserBubble,
                color: isLightColor(activeUserBubble) ? '#333' : '#fff',
              }}
            >
              <p>{t('preview_msg_2')}</p>
              <p className="text-[10px] opacity-60 text-right mt-1">10:31</p>
            </div>
            <div
              className="self-start rounded-lg px-3 py-2 text-sm max-w-[60%] shadow-sm"
              style={{
                backgroundColor: activeContactBubble,
                color: isLightColor(activeContactBubble) ? '#333' : '#fff',
              }}
            >
              <p>{t('preview_msg_3')}</p>
              <p className="text-[10px] opacity-60 text-right mt-1">10:32</p>
            </div>
            <div
              className="self-end rounded-lg px-3 py-2 text-sm max-w-[60%] shadow-sm"
              style={{
                backgroundColor: activeUserBubble,
                color: isLightColor(activeUserBubble) ? '#333' : '#fff',
              }}
            >
              <p>{t('preview_msg_4')}</p>
              <p className="text-[10px] opacity-60 text-right mt-1">10:33</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('saving_btn')}
            </>
          ) : (
            t('save_btn')
          )}
        </Button>
      </div>
    </div>
  );
}

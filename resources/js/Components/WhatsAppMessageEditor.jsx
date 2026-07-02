import { useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Variable, X } from 'lucide-react';

const inputClass =
    'mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

export default function WhatsAppMessageEditor({
    body,
    mediaUrl,
    onBodyChange,
    onMediaChange,
    contactTokens = [],
    onInsertToken,
    error,
}) {
    const { t } = useTranslation();
    const fileRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const uploadImage = async (file) => {
        if (!file) return;
        setUploading(true);
        setUploadError('');
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('collection', 'campaign-media');
            const res = await axios.post(route('client.media.store'), fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            onMediaChange(res.data.url, file.name);
        } catch (err) {
            setUploadError(err?.response?.data?.error ?? t('campaign.upload_failed'));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('campaign.whatsapp_message')}
                </label>
                {contactTokens.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {contactTokens.slice(0, 4).map((token) => (
                            <button
                                key={token.key}
                                type="button"
                                onClick={() => onInsertToken?.(token.key)}
                                className="inline-flex items-center gap-1 rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            >
                                <Variable className="h-3 w-3" />
                                {token.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <textarea
                value={body}
                onChange={(e) => onBodyChange(e.target.value)}
                rows={7}
                placeholder={t('campaign.unofficial_body_placeholder')}
                className={`${inputClass} resize-y min-h-[140px]`}
            />
            {error && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {error}
                </p>
            )}

            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => uploadImage(e.target.files?.[0])}
                    />
                    <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                    >
                        {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <ImagePlus className="h-4 w-4" />
                        )}
                        {uploading ? t('campaign.uploading') : t('campaign.attach_photo')}
                    </button>
                    {mediaUrl && (
                        <button
                            type="button"
                            onClick={() => onMediaChange('', null)}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                        >
                            <X className="h-3.5 w-3.5" /> {t('campaign.remove_photo')}
                        </button>
                    )}
                </div>
                {uploadError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> {uploadError}
                    </p>
                )}
                {mediaUrl && (
                    <div className="flex items-start gap-3">
                        <img
                            src={mediaUrl}
                            alt=""
                            className="h-24 w-24 rounded-lg border border-neutral-200 dark:border-neutral-700 object-cover"
                        />
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('campaign.photo_attached')}
                        </p>
                    </div>
                )}
                {!mediaUrl && (
                    <p className="text-xs text-neutral-500">{t('campaign.photo_optional_hint')}</p>
                )}
            </div>
        </div>
    );
}

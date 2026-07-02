import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, usePage, router } from '@inertiajs/react';
import { Trans, useTranslation } from 'react-i18next';
import axios from 'axios';
import {
    ArrowLeft,
    ArrowRight,
    Send,
    Users,
    Search,
    Variable,
    Eye,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Save,
    Upload,
    Link as LinkIcon,
} from 'lucide-react';
import { browserTz, formatInTz, tzLocalToUtcIso, utcToTzLocal } from '@/Utils/datetime';
import { ChannelBrandIcon } from '@/Components/BrandIcons';
import EmailEditor from '@/Components/EmailEditor';
import TimezonePicker from '@/Components/TimezonePicker';
import { DatePicker } from '@/Components/ui';

import TemplatePreview from '@/Components/TemplatePreview';
import WhatsAppMessageEditor from '@/Components/WhatsAppMessageEditor';

const SEND_PRESETS = {
    safe: { messages_per_minute: 15, chunk_size: 50, chunk_pause_seconds: 120 },
    normal: { messages_per_minute: 30, chunk_size: 100, chunk_pause_seconds: 60 },
    fast: { messages_per_minute: 45, chunk_size: 150, chunk_pause_seconds: 30 },
};

const defaultSendSettings = () => ({
    preset: 'normal',
    ...SEND_PRESETS.normal,
});

const CHANNEL_META = {
    whatsapp: { label: 'WhatsApp', Icon: (p) => <ChannelBrandIcon channel="whatsapp" {...p} /> },
    sms: { label: 'SMS', Icon: (p) => <ChannelBrandIcon channel="sms" {...p} /> },
    email: { label: 'Email', Icon: (p) => <ChannelBrandIcon channel="email" {...p} /> },
};

const inputClass =
    'mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

function FieldError({ message }) {
    if (!message) return null;
    return (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {message}
        </p>
    );
}

function defaultInitialData(campaign, userTz) {
    const fallbackTz = userTz || browserTz() || 'Asia/Dhaka';
    if (campaign) {
        const tz = campaign.timezone || fallbackTz;
        return {
            name: campaign.name ?? '',
            channel: campaign.channel ?? 'whatsapp',
            whatsapp_phone_number_id: campaign.whatsapp_phone_number_id ?? '',
            audience_type: campaign.audience_type ?? 'segment',
            audience_ref: campaign.audience_ref ?? '',
            template_ref: {
                name: campaign.template_ref?.name ?? '',
                language: campaign.template_ref?.language ?? 'en',
                components: campaign.template_ref?.components ?? [],
            },
            payload_json: {
                subject: campaign.payload_json?.subject ?? '',
                body: campaign.payload_json?.body ?? '',
                from_email: campaign.payload_json?.from_email ?? '',
                from_name: campaign.payload_json?.from_name ?? '',
                reply_to: campaign.payload_json?.reply_to ?? '',
                track_opens: campaign.payload_json?.track_opens ?? true,
                track_clicks: campaign.payload_json?.track_clicks ?? false,
                media_url: campaign.payload_json?.media_url ?? '',
                media_type: campaign.payload_json?.media_type ?? 'image',
                media_filename: campaign.payload_json?.media_filename ?? '',
                send_settings: {
                    ...defaultSendSettings(),
                    ...(campaign.payload_json?.send_settings ?? {}),
                },
            },
            send_mode: campaign.schedule_at ? 'scheduled' : 'now',
            schedule_at: campaign.schedule_at ? utcToTzLocal(campaign.schedule_at, tz) : '',
            timezone: tz,
        };
    }

    return {
        name: '',
        channel: 'whatsapp',
        whatsapp_phone_number_id: '',
        audience_type: 'csv',
        audience_ref: '',
        template_ref: { name: '', language: 'en', components: [] },
        payload_json: {
            subject: '',
            body: '',
            from_email: '',
            from_name: '',
            reply_to: '',
            track_opens: true,
            track_clicks: false,
            media_url: '',
            media_type: 'image',
            media_filename: '',
            send_settings: defaultSendSettings(),
        },
        send_mode: 'now',
        schedule_at: '',
        timezone: fallbackTz,
    };
}

/**
 * Convert a Meta WhatsApp template's `components` (the canonical sample
 * synced from the Meta Graph API) into our editable per-parameter shape.
 *
 * Returns: [{ section: 'header'|'body'|'button', sub_type, button_index, slots: [{ kind, value, label }] }]
 *
 * For each `{{N}}` placeholder we infer in the template's `text`, we create
 * a "slot" the user can fill in. Header media is detected via `format`.
 */
function deriveSlotsFromTemplate(components = []) {
    const out = [];

    components.forEach((c) => {
        if (!c || typeof c !== 'object') return;
        const type = (c.type || '').toLowerCase();

        if (type === 'header') {
            const format = (c.format || '').toUpperCase();
            if (format === 'TEXT') {
                const slots = extractTextSlots(c.text || '');
                if (slots.length) {
                    out.push({ section: 'header', sub_type: 'text', slots });
                }
            } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
                out.push({
                    section: 'header',
                    sub_type: format.toLowerCase(),
                    slots: [{ kind: 'static', value: '', label: `${format.toLowerCase()} URL`, mediaKind: format.toLowerCase() }],
                });
            }
        } else if (type === 'body') {
            const slots = extractTextSlots(c.text || '');
            if (slots.length) out.push({ section: 'body', sub_type: 'text', slots });
        } else if (type === 'buttons' && Array.isArray(c.buttons)) {
            c.buttons.forEach((btn, idx) => {
                if (!btn) return;
                const btnType = (btn.type || '').toLowerCase();
                if (btnType === 'url' && typeof btn.url === 'string' && btn.url.includes('{{')) {
                    out.push({
                        section: 'button',
                        sub_type: 'url',
                        button_index: idx,
                        slots: [{ kind: 'static', value: '', label: `Button ${idx + 1} URL parameter` }],
                    });
                }
                if (btnType === 'copy_code') {
                    out.push({
                        section: 'button',
                        sub_type: 'copy_code',
                        button_index: idx,
                        slots: [{ kind: 'static', value: '', label: `Button ${idx + 1} copy code` }],
                    });
                }
            });
        }
    });

    return out;
}

function extractTextSlots(text) {
    const matches = (text || '').match(/\{\{\s*\d+\s*\}\}/g) || [];
    return matches.map((m, i) => ({
        kind: 'static',
        value: '',
        label: `Variable ${m.replace(/\s+/g, '')} (slot ${i + 1})`,
    }));
}

/**
 * Convert our editable slots back into the Meta Cloud API `components` payload.
 */
function slotsToMetaComponents(slots) {
    return slots
        .filter((s) => s.slots && s.slots.length)
        .map((section) => {
            if (section.section === 'header' && section.sub_type === 'text') {
                return {
                    type: 'header',
                    parameters: section.slots.map((slot) => ({
                        type: 'text',
                        text: slot.kind === 'variable' ? slot.value : slot.value,
                    })),
                };
            }

            if (section.section === 'header' && ['image', 'video', 'document'].includes(section.sub_type)) {
                const slot = section.slots[0];
                const mediaKey = section.sub_type;
                const param = { type: mediaKey, [mediaKey]: { link: slot.value } };
                if (mediaKey === 'document' && slot.filename) {
                    param.document.filename = slot.filename;
                }
                return { type: 'header', parameters: [param] };
            }

            if (section.section === 'body') {
                return {
                    type: 'body',
                    parameters: section.slots.map((slot) => ({
                        type: 'text',
                        text: slot.value,
                    })),
                };
            }

            if (section.section === 'button') {
                return {
                    type: 'button',
                    sub_type: section.sub_type,
                    index: String(section.button_index),
                    parameters: section.slots.map((slot) => ({
                        type: section.sub_type === 'copy_code' ? 'coupon_code' : 'text',
                        text: slot.value,
                    })),
                };
            }

            return null;
        })
        .filter(Boolean);
}

function pickPreviewText(components) {
    if (!Array.isArray(components)) return '';
    const body = components.find((c) => c && (c.type || '').toLowerCase() === 'body');
    return body?.text || '';
}

function renderPreview(text, slots, contactTokens) {
    if (!text) return '';
    let i = 0;
    return text.replace(/\{\{\s*(\d+)\s*\}\}/g, () => {
        const flatSlots = slots.flatMap((s) => (s.section === 'body' ? s.slots : []));
        const slot = flatSlots[i++];
        if (!slot) return '___';
        if (!slot.value) return '___';
        // If user picked a token like {{contact.first_name}}, show the friendly label
        if (slot.value.startsWith('{{')) {
            const tok = contactTokens.find((t) => t.key === slot.value);
            return tok ? `[${tok.label}]` : slot.value;
        }
        return slot.value;
    });
}

export default function CampaignForm({
    campaign = null,
    mode = 'create',
    whatsappTemplates = [],
    whatsappPhoneNumbers = [],
    whatsappSenders = [],
    segments = [],
    tags = [],
    contactTokens = [],
}) {
    const { t } = useTranslation();
    const senders = whatsappSenders.length > 0 ? whatsappSenders : whatsappPhoneNumbers;
    const [draftUuid, setDraftUuid] = useState(campaign?.uuid ?? null);
    const [draftStatus, setDraftStatus] = useState(null);
    const [launching, setLaunching] = useState(false);
    const [audiencePreview, setAudiencePreview] = useState({
        loading: false,
        matched: 0,
        deliverable: 0,
        sample: [],
        error: null,
    });
    const [testTo, setTestTo] = useState({ phone_e164: '', email: '', sending: false, result: null });

    const userTz = usePage().props.timezone || browserTz() || 'Asia/Dhaka';
    const initialData = useMemo(() => defaultInitialData(campaign, userTz), [campaign?.id]);
    const { data, setData, post, patch, processing, errors, transform } = useForm(initialData);

    const selectedSender = useMemo(
        () => senders.find((s) => s.phone_number_id === data.whatsapp_phone_number_id) ?? null,
        [senders, data.whatsapp_phone_number_id],
    );
    const isUnofficialSender = selectedSender?.provider === 'wppconnect';

    // Templates filtered to the selected phone number's WABA.
    const filteredTemplates = useMemo(() => {
        if (data.channel !== 'whatsapp' || !data.whatsapp_phone_number_id) return whatsappTemplates;
        if (isUnofficialSender) return whatsappTemplates;
        const phone = senders.find((p) => p.phone_number_id === data.whatsapp_phone_number_id);
        if (!phone?.waba_id) return whatsappTemplates;
        return whatsappTemplates.filter((tpl) => tpl.waba_id === phone.waba_id);
    }, [whatsappTemplates, senders, data.channel, data.whatsapp_phone_number_id, isUnofficialSender]);

    // The selected WhatsApp template (from the workspace) — used to derive parameter slots.
    const selectedTemplate = useMemo(() => {
        if (data.channel !== 'whatsapp' || !data.template_ref?.name) return null;
        return (
            filteredTemplates.find(
                (t) =>
                    t.name === data.template_ref.name &&
                    t.language === data.template_ref.language,
            ) ?? null
        );
    }, [filteredTemplates, data.channel, data.template_ref.name, data.template_ref.language]);

    // Derive parameter slots from the template's canonical components.
    // We keep the slot user-input separately and only marshal back into Meta shape on submit.
    const [slots, setSlots] = useState(() => deriveSlotsFromTemplate(selectedTemplate?.components ?? []));

    // Auto-select the only phone number when switching to WhatsApp with a single number.
    useEffect(() => {
        if (data.channel === 'whatsapp' && senders.length === 1 && !data.whatsapp_phone_number_id) {
            setData('whatsapp_phone_number_id', senders[0].phone_number_id);
        }
        if (data.channel !== 'whatsapp' && data.whatsapp_phone_number_id) {
            setData('whatsapp_phone_number_id', '');
        }
    }, [data.channel]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (data.channel !== 'whatsapp' || !isUnofficialSender || !selectedTemplate) return;
        const bodyText = pickPreviewText(selectedTemplate.components ?? []);
        if (bodyText) {
            setData('payload_json', { ...data.payload_json, body: bodyText });
        }
    }, [selectedTemplate?.id, isUnofficialSender, data.channel]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset template when the phone number changes (templates are WABA-scoped).
    const prevPhoneRef = useRef(data.whatsapp_phone_number_id);
    useEffect(() => {
        if (prevPhoneRef.current !== data.whatsapp_phone_number_id) {
            prevPhoneRef.current = data.whatsapp_phone_number_id;
            setData('template_ref', { name: '', language: 'en', components: [] });
        }
    }, [data.whatsapp_phone_number_id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Whenever the user picks a different template, reset slots from its canonical components.
    useEffect(() => {
        if (data.channel === 'whatsapp' && selectedTemplate) {
            const next = deriveSlotsFromTemplate(selectedTemplate.components ?? []);
            setSlots((prev) => {
                // If the user has already filled values for the same template, preserve them.
                if (
                    prev.length === next.length &&
                    prev.every(
                        (p, i) =>
                            p.section === next[i].section &&
                            p.sub_type === next[i].sub_type &&
                            p.slots.length === next[i].slots.length,
                    )
                ) {
                    return prev;
                }
                return next;
            });
        } else if (data.channel !== 'whatsapp') {
            setSlots([]);
        }
    }, [selectedTemplate, data.channel]);

    // Persist slots into form data as Meta-shape components on every change.
    useEffect(() => {
        if (data.channel !== 'whatsapp') return;
        const components = slotsToMetaComponents(slots);
        // Avoid noisy re-renders if components haven't actually changed.
        const sameJson = JSON.stringify(data.template_ref.components) === JSON.stringify(components);
        if (!sameJson) {
            setData('template_ref', { ...data.template_ref, components });
        }
    }, [slots, data.channel]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Audience preview (debounced) ──────────────────────────────────────────
    const debounceRef = useRef(null);
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!data.audience_ref) {
            setAudiencePreview({ loading: false, matched: 0, deliverable: 0, sample: [], error: null });
            return;
        }
        debounceRef.current = setTimeout(() => {
            setAudiencePreview((p) => ({ ...p, loading: true, error: null }));
            axios
                .post(route('client.campaigns.audience-preview'), {
                    audience_type: data.audience_type,
                    audience_ref: data.audience_ref,
                    channel: data.channel,
                })
                .then((r) =>
                    setAudiencePreview({
                        loading: false,
                        matched: r.data.matched ?? 0,
                        deliverable: r.data.deliverable ?? 0,
                        sample: r.data.sample ?? [],
                        error: null,
                    }),
                )
                .catch((e) =>
                    setAudiencePreview({
                        loading: false,
                        matched: 0,
                        deliverable: 0,
                        sample: [],
                        error: e?.response?.data?.message ?? t('campaign.preview_error'),
                    }),
                );
        }, 350);
        return () => debounceRef.current && clearTimeout(debounceRef.current);
    }, [data.audience_type, data.audience_ref, data.channel]);

    // ── Step navigation ───────────────────────────────────────────────────────
    // Returns true on success, false on failure.
    const saveDraft = async () => {
        setDraftStatus('saving');
        try {
            const payload = {
                uuid: draftUuid,
                name: data.name,
                channel: data.channel,
                whatsapp_phone_number_id: data.whatsapp_phone_number_id || null,
                audience_type: data.audience_type,
                audience_ref: data.audience_ref || null,
                template_ref: data.template_ref,
                payload_json: data.payload_json,
                timezone: data.timezone,
                schedule_at: data.send_mode === 'scheduled' && data.schedule_at
                    ? tzLocalToUtcIso(data.schedule_at, data.timezone || 'UTC')
                    : null,
            };
            const res = await axios.post(route('client.campaigns.store-draft'), payload);
            setDraftUuid(res.data.uuid);
            setDraftStatus('saved');
            setTimeout(() => setDraftStatus(null), 3000);
            return res.data.uuid;
        } catch {
            setDraftStatus('error');
            setTimeout(() => setDraftStatus(null), 4000);
            return null;
        }
    };

    const isFormValid = useMemo(() => {
        if (!data.name.trim() || !data.channel) return false;

        if (data.channel === 'whatsapp') {
            if (senders.length === 0) return false;
            if (senders.length > 1 && !data.whatsapp_phone_number_id) return false;
        }

        if (!data.audience_ref) return false;

        if (data.send_mode === 'scheduled' && !data.schedule_at) return false;

        if (data.channel === 'whatsapp') {
            if (isUnofficialSender) {
                const hasBody = (data.payload_json.body || '').trim().length > 0;
                const hasMedia = !!(data.payload_json.media_url || '').trim();
                return hasBody || hasMedia;
            }
            return !!data.template_ref.name;
        }
        if (data.channel === 'sms') return (data.payload_json.body || '').trim().length > 0;
        if (data.channel === 'email') {
            return (
                (data.payload_json.subject || '').trim().length > 0 &&
                (data.payload_json.body || '').trim().length > 0
            );
        }
        return true;
    }, [data, senders, isUnofficialSender]);

    const handleSendNow = async () => {
        if (!isFormValid) return;
        setLaunching(true);
        const uuid = await saveDraft();
        if (!uuid) {
            setLaunching(false);
            return;
        }
        router.post(
            route('client.campaigns.launch', uuid),
            {
                schedule_at:
                    data.send_mode === 'scheduled' && data.schedule_at
                        ? tzLocalToUtcIso(data.schedule_at, data.timezone || 'UTC')
                        : '',
            },
            { preserveScroll: false },
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // The `<input type="datetime-local">` writes a wall-clock string that
        // has no timezone info. Convert it to a UTC ISO 8601 string in the
        // campaign's chosen timezone before sending — otherwise Laravel will
        // parse it as UTC and the campaign will fire at the wrong moment.
        transform((d) => ({
            ...d,
            schedule_at:
                d.send_mode === 'scheduled' && d.schedule_at
                    ? tzLocalToUtcIso(d.schedule_at, d.timezone || 'UTC')
                    : null,
            audience_ref: d.audience_ref ? String(d.audience_ref) : null,
            audience_type: 'csv',
        }));

        if (draftUuid) {
            patch(route('client.campaigns.update', draftUuid));
        } else {
            post(route('client.campaigns.store'));
        }
    };

    // ── Test send ────────────────────────────────────────────────────────────
    const sendTest = () => {
        if (!campaign?.uuid) return;
        setTestTo((s) => ({ ...s, sending: true, result: null }));
        axios
            .post(route('client.campaigns.test-send', campaign.uuid), {
                phone_e164: testTo.phone_e164 || null,
                email: testTo.email || null,
            })
            .then((r) =>
                setTestTo((s) => ({
                    ...s,
                    sending: false,
                    result: { ok: true, message: t('campaign.test_sent', { id: r.data.message_id || 'OK' }) },
                })),
            )
            .catch((e) =>
                setTestTo((s) => ({
                    ...s,
                    sending: false,
                    result: { ok: false, message: e?.response?.data?.error ?? t('campaign.test_failed') },
                })),
            );
    };

    // ── Slot helpers ──────────────────────────────────────────────────────────
    const updateSlot = (sectionIdx, slotIdx, patchObj) => {
        setSlots((prev) =>
            prev.map((s, i) =>
                i === sectionIdx
                    ? {
                          ...s,
                          slots: s.slots.map((sl, j) => (j === slotIdx ? { ...sl, ...patchObj } : sl)),
                      }
                    : s,
            ),
        );
    };

    const insertTokenIntoTextarea = (field, token) => {
        const current = data.payload_json[field] || '';
        setData('payload_json', { ...data.payload_json, [field]: current + token });
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
                <div className="space-y-4">
                    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-6 space-y-8">
                        <SetupStep
                            data={data}
                            setData={setData}
                            errors={errors}
                            senders={senders}
                            isUnofficialSender={isUnofficialSender}
                            preview={audiencePreview}
                            setAudiencePreview={setAudiencePreview}
                            whatsappTemplates={filteredTemplates}
                            selectedTemplate={selectedTemplate}
                            slots={slots}
                            updateSlot={updateSlot}
                            contactTokens={contactTokens}
                            insertTokenIntoTextarea={insertTokenIntoTextarea}
                            campaignName={data.name}
                        />

                        <SendSettingsPanel data={data} setData={setData} />

                        <InlineSchedulePanel data={data} setData={setData} errors={errors} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {draftStatus === 'saving' && (
                            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('campaign.saving_draft')}
                            </span>
                        )}
                        {draftStatus === 'saved' && (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                                <Save className="h-3.5 w-3.5" /> {t('campaign.draft_saved')}
                            </span>
                        )}
                        {draftStatus === 'error' && (
                            <span className="flex items-center gap-1.5 text-xs text-red-500">
                                <AlertCircle className="h-3.5 w-3.5" /> {t('campaign.draft_save_failed')}
                            </span>
                        )}

                        <button
                            type="submit"
                            disabled={processing || launching}
                            className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                        >
                            {processing ? t('campaign.saving') : mode === 'edit' ? t('campaign.save_changes') : t('campaign.save_draft')}
                        </button>

                        <button
                            type="button"
                            disabled={!isFormValid || launching || processing || draftStatus === 'saving'}
                            onClick={handleSendNow}
                            className="ml-auto flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
                        >
                            {launching ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> {t('campaign.launching')}</>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    {data.send_mode === 'scheduled' ? t('campaign.schedule_send') : t('campaign.send_now')}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <PreviewPane
                    data={data}
                    selectedTemplate={selectedTemplate}
                    slots={slots}
                    contactTokens={contactTokens}
                    audiencePreview={audiencePreview}
                    senders={senders}
                    isUnofficialSender={isUnofficialSender}
                />
            </div>
        </form>
    );
}

// ─── Step components ──────────────────────────────────────────────────────────

function SetupStep({
    data,
    setData,
    errors,
    senders,
    isUnofficialSender,
    preview,
    setAudiencePreview,
    whatsappTemplates,
    selectedTemplate,
    slots,
    updateSlot,
    contactTokens,
    insertTokenIntoTextarea,
    campaignName,
}) {
    const { t } = useTranslation();

    return (
        <div className="space-y-8">
            <ChannelStep
                data={data}
                setData={setData}
                errors={errors}
                senders={senders}
            />

            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
                <AudienceStep
                    data={data}
                    setData={setData}
                    preview={preview}
                    setAudiencePreview={setAudiencePreview}
                    errors={errors}
                />
            </div>

            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
                <ContentStep
                    data={data}
                    setData={setData}
                    whatsappTemplates={whatsappTemplates}
                    selectedTemplate={selectedTemplate}
                    slots={slots}
                    updateSlot={updateSlot}
                    contactTokens={contactTokens}
                    insertTokenIntoTextarea={insertTokenIntoTextarea}
                    errors={errors}
                    campaignName={campaignName}
                    isUnofficialSender={isUnofficialSender}
                />
            </div>
        </div>
    );
}

function AudiencePhoneUpload({ data, setData, setAudiencePreview }) {
    const { t } = useTranslation();
    const [pasteText, setPasteText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileRef = useRef(null);

    const upload = async (phonesText, file) => {
        setUploading(true);
        setUploadError('');
        try {
            const fd = new FormData();
            if (file) fd.append('file', file);
            if (phonesText?.trim()) fd.append('phones_text', phonesText.trim());
            const res = await axios.post(route('client.campaigns.upload-audience'), fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setData('audience_type', 'csv');
            setData('audience_ref', res.data.path);
            setAudiencePreview({
                loading: false,
                matched: res.data.count ?? 0,
                deliverable: res.data.count ?? 0,
                sample: (res.data.sample ?? []).map((phone) => ({ phone_e164: phone })),
                error: null,
            });
            setPasteText('');
            if (fileRef.current) fileRef.current.value = '';
        } catch (e) {
            setUploadError(e?.response?.data?.message ?? t('campaign.upload_failed'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                <Upload className="h-4 w-4" />
                {t('campaign.upload_phones')}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('campaign.upload_phones_hint')}
            </p>
            <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                placeholder={t('campaign.phones_placeholder')}
                className={`${inputClass} font-mono text-xs`}
            />
            <div className="flex flex-wrap items-center gap-2">
                <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload(pasteText, file);
                    }}
                />
                <button
                    type="button"
                    disabled={uploading}
                    onClick={() => upload(pasteText, fileRef.current?.files?.[0])}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? t('campaign.uploading') : t('campaign.load_contacts')}
                </button>
                <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    {t('campaign.choose_file')}
                </button>
            </div>
            {uploadError && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {uploadError}
                </p>
            )}
            {data.audience_type === 'csv' && data.audience_ref && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('campaign.contacts_loaded', { count: preview.deliverable || preview.matched || 0 })}
                </p>
            )}
        </div>
    );
}

function ChannelStep({ data, setData, errors, senders = [] }) {
    const { t } = useTranslation();
    return (
        <>
            <h3 className="font-medium text-neutral-800 dark:text-neutral-200">{t('campaign.name_and_channel')}</h3>
            <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('common.name')}</label>
                <input
                    type="text"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder={t('campaign.name_placeholder')}
                    required
                    className={inputClass}
                />
                <FieldError message={errors.name} />
            </div>
            <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-2">
                    {t('campaign.channel')}
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {Object.entries(CHANNEL_META).map(([val, meta]) => {
                        const Brand = meta.Icon;
                        const active = data.channel === val;
                        return (
                            <button
                                key={val}
                                type="button"
                                onClick={() => setData('channel', val)}
                                className={`rounded-xl border p-4 text-sm font-medium transition flex flex-col items-center gap-2 ${
                                    active
                                        ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-brand-300'
                                }`}
                            >
                                <Brand className="h-6 w-6" />
                                {meta.label}
                            </button>
                        );
                    })}
                </div>
                <FieldError message={errors.channel} />
            </div>

            {data.channel === 'whatsapp' && senders.length > 0 && (
                <div>
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-2">
                        {t('campaign.send_from')}
                    </label>
                    {senders.length === 1 ? (
                        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 flex items-center justify-between gap-2">
                            <span>
                                {senders[0].display_phone}
                                {senders[0].verified_name && (
                                    <span className="ml-2 text-neutral-500 dark:text-neutral-400">
                                        — {senders[0].verified_name}
                                    </span>
                                )}
                            </span>
                            <SenderBadge provider={senders[0].provider} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {senders.map((p) => {
                                const active = data.whatsapp_phone_number_id === p.phone_number_id;
                                return (
                                    <button
                                        key={p.phone_number_id}
                                        type="button"
                                        onClick={() => setData('whatsapp_phone_number_id', p.phone_number_id)}
                                        className={`rounded-xl border p-3 text-sm font-medium transition flex flex-col items-start gap-1.5 text-left ${
                                            active
                                                ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                                                : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-brand-300'
                                        }`}
                                    >
                                        <div className="flex w-full items-start justify-between gap-2">
                                            <span>{p.display_phone}</span>
                                            <SenderBadge provider={p.provider} />
                                        </div>
                                        {p.verified_name && (
                                            <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                                                {p.verified_name}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <FieldError message={errors.whatsapp_phone_number_id} />
                </div>
            )}

            {data.channel === 'whatsapp' && senders.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                    {t('campaign.no_whatsapp_senders')}
                </p>
            )}

            {data.channel === 'email' && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-4">
                    <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{t('campaign.sender')}</div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                {t('campaign.from_name')}
                            </label>
                            <input
                                type="text"
                                value={data.payload_json.from_name}
                                onChange={(e) => setData('payload_json', { ...data.payload_json, from_name: e.target.value })}
                                placeholder={t('campaign.from_name_placeholder')}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                                {t('campaign.from_email')}
                            </label>
                            <input
                                type="email"
                                value={data.payload_json.from_email}
                                onChange={(e) => setData('payload_json', { ...data.payload_json, from_email: e.target.value })}
                                placeholder={t('campaign.from_email_placeholder')}
                                className={inputClass}
                            />
                            <FieldError message={errors['payload_json.from_email']} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                            {t('campaign.reply_to')} <span className="font-normal text-neutral-400">({t('common.optional')})</span>
                        </label>
                        <input
                            type="email"
                            value={data.payload_json.reply_to}
                            onChange={(e) => setData('payload_json', { ...data.payload_json, reply_to: e.target.value })}
                            placeholder="support@acme.com"
                            className={inputClass}
                        />
                        <FieldError message={errors['payload_json.reply_to']} />
                    </div>
                </div>
            )}

            {data.channel === 'email' && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-4">
                    <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{t('campaign.tracking')}</div>
                    <ToggleSwitch
                        checked={!!data.payload_json.track_opens}
                        onChange={(v) => setData('payload_json', { ...data.payload_json, track_opens: v })}
                        label={t('campaign.open_tracking')}
                        description={t('campaign.open_tracking_desc')}
                    />
                    <ToggleSwitch
                        checked={!!data.payload_json.track_clicks}
                        onChange={(v) => setData('payload_json', { ...data.payload_json, track_clicks: v })}
                        label={t('campaign.click_tracking')}
                        description={t('campaign.click_tracking_desc')}
                    />
                </div>
            )}
        </>
    );
}

function SenderBadge({ provider }) {
    const { t } = useTranslation();
    const isQr = provider === 'wppconnect';
    return (
        <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                isQr
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
            }`}
        >
            {isQr ? t('campaign.provider_qr') : t('campaign.provider_official')}
        </span>
    );
}

function AudienceStep({ data, setData, preview, setAudiencePreview, errors }) {
    const { t } = useTranslation();

    return (
        <>
            <h3 className="font-medium text-neutral-800 dark:text-neutral-200">{t('campaign.recipients')}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('campaign.recipients_hint')}</p>

            <AudiencePhoneUpload
                data={data}
                setData={setData}
                setAudiencePreview={setAudiencePreview}
            />

            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    <Users className="h-4 w-4" />
                    {preview.loading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('campaign.counting')}
                        </span>
                    ) : data.audience_ref ? (
                        <span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {(preview.deliverable || preview.matched || 0).toLocaleString()}
                            </span>{' '}
                            {t('campaign.recipients_ready')}
                        </span>
                    ) : (
                        <span className="text-neutral-500">{t('campaign.upload_phones_to_preview')}</span>
                    )}
                </div>
                {preview.error && (
                    <p className="mt-2 text-xs text-red-600">{preview.error}</p>
                )}
                {preview.sample.length > 0 && (
                    <p className="mt-2 text-xs text-neutral-500 font-mono truncate">
                        {preview.sample.map((c) => c.phone_e164 || c.email).filter(Boolean).join(', ')}
                    </p>
                )}
            </div>
            <FieldError message={errors.audience_ref} />
        </>
    );
}

function ContentStep({
    data,
    setData,
    whatsappTemplates,
    selectedTemplate,
    slots,
    updateSlot,
    contactTokens,
    insertTokenIntoTextarea,
    errors,
    campaignName,
    isUnofficialSender = false,
}) {
    const { t } = useTranslation();
    return (
        <>
            <h3 className="font-medium text-neutral-800 dark:text-neutral-200">{t('campaign.message_content')}</h3>

            {data.channel === 'whatsapp' && isUnofficialSender && (
                <WhatsAppMessageEditor
                    body={data.payload_json.body || ''}
                    mediaUrl={data.payload_json.media_url || ''}
                    onBodyChange={(v) => setData('payload_json', { ...data.payload_json, body: v })}
                    onMediaChange={(url, filename) =>
                        setData('payload_json', {
                            ...data.payload_json,
                            media_url: url,
                            media_type: 'image',
                            media_filename: filename || '',
                        })
                    }
                    contactTokens={contactTokens}
                    onInsertToken={(token) => insertTokenIntoTextarea('body', `{{${token}}}`)}
                    error={errors['payload_json.body']}
                />
            )}

            {data.channel === 'whatsapp' && !isUnofficialSender && (
                <>
                    <div>
                        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            {t('campaign.whatsapp_template')}
                        </label>
                        <select
                            value={
                                whatsappTemplates.find(
                                    (tpl) =>
                                        tpl.name === data.template_ref.name &&
                                        tpl.language === data.template_ref.language,
                                )?.id ?? ''
                            }
                            onChange={(e) => {
                                const v = e.target.value;
                                if (!v) {
                                    setData('template_ref', { name: '', language: 'en', components: [] });
                                    return;
                                }
                                const tpl = whatsappTemplates.find((x) => String(x.id) === v);
                                if (tpl) {
                                    setData('template_ref', {
                                        ...data.template_ref,
                                        name: tpl.name,
                                        language: tpl.language,
                                    });
                                }
                            }}
                            className={inputClass}
                        >
                            <option value="">{t('campaign.select_template')}</option>
                            {whatsappTemplates.map((tpl) => (
                                <option key={tpl.id} value={tpl.id}>
                                    {tpl.name} ({tpl.language}) — {tpl.status}
                                </option>
                            ))}
                        </select>
                        {whatsappTemplates.length === 0 && (
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {t('campaign.no_templates_synced')}
                            </p>
                        )}
                        <FieldError message={errors['template_ref.name']} />
                    </div>

                    {selectedTemplate && slots.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                <Variable className="h-4 w-4" /> {t('campaign.template_variables')}
                            </div>
                            {slots.map((section, sIdx) => (
                                <div
                                    key={`${section.section}-${section.sub_type}-${section.button_index ?? 'x'}`}
                                    className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 space-y-3"
                                >
                                    <div className="text-xs uppercase tracking-wider font-semibold text-neutral-500">
                                        {t(`campaign.section_${section.section}`, section.section)}
                                        {section.sub_type ? ` · ${section.sub_type}` : ''}
                                        {section.button_index != null ? ` · ${t('campaign.button_n', { n: section.button_index + 1 })}` : ''}
                                    </div>
                                    {section.slots.map((slot, slotIdx) => (
                                        <SlotInput
                                            key={slotIdx}
                                            slot={slot}
                                            label={slot.label}
                                            mediaKind={slot.mediaKind}
                                            contactTokens={contactTokens}
                                            onChange={(patch) => updateSlot(sIdx, slotIdx, patch)}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedTemplate && slots.length === 0 && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {t('campaign.no_variables')}
                        </p>
                    )}

                    {selectedTemplate && (
                        <div className="lg:hidden">
                            <TemplatePreview components={selectedTemplate.components ?? []} />
                        </div>
                    )}
                </>
            )}

            {data.channel === 'sms' && (
                <BodyTextarea
                    label={t('campaign.sms_body')}
                    field="body"
                    value={data.payload_json.body}
                    onChange={(v) => setData('payload_json', { ...data.payload_json, body: v })}
                    placeholder={t('campaign.sms_body_placeholder')}
                    rows={4}
                    contactTokens={contactTokens}
                    onInsertToken={(token) => insertTokenIntoTextarea('body', `{{${token}}}`)}
                    error={errors['payload_json.body']}
                />
            )}

            {data.channel === 'email' && (
                <>
                    <EmailEditor
                        subject={data.payload_json.subject}
                        body={data.payload_json.body}
                        onSubjectChange={(v) => setData('payload_json', { ...data.payload_json, subject: v })}
                        onBodyChange={(v) => setData('payload_json', { ...data.payload_json, body: v })}
                        contactTokens={contactTokens}
                        campaignName={campaignName}
                    />
                    {errors['payload_json.subject'] && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {errors['payload_json.subject']}
                        </p>
                    )}
                    {errors['payload_json.body'] && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {errors['payload_json.body']}
                        </p>
                    )}

                </>
            )}
        </>
    );
}

function SendSettingsPanel({ data, setData }) {
    const { t } = useTranslation();
    const settings = data.payload_json.send_settings ?? defaultSendSettings();

    const setPreset = (preset) => {
        const base = preset === 'custom'
            ? settings
            : { preset, ...SEND_PRESETS[preset] };
        setData('payload_json', {
            ...data.payload_json,
            send_settings: base,
        });
    };

    const updateCustom = (key, value) => {
        setData('payload_json', {
            ...data.payload_json,
            send_settings: {
                ...settings,
                preset: 'custom',
                [key]: value,
            },
        });
    };

    const mpm = settings.messages_per_minute ?? 30;

    return (
        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6 space-y-4">
            <h3 className="font-medium text-neutral-800 dark:text-neutral-200">{t('campaign.send_speed')}</h3>
            <p className="text-sm text-neutral-500">{t('campaign.send_speed_hint')}</p>

            <div className="grid grid-cols-3 gap-2">
                {[
                    ['safe', t('campaign.preset_safe'), '15/мин'],
                    ['normal', t('campaign.preset_normal'), '30/мин'],
                    ['fast', t('campaign.preset_fast'), '45/мин'],
                ].map(([key, label, rate]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setPreset(key)}
                        className={`rounded-lg border p-3 text-left transition ${
                            settings.preset === key
                                ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20'
                                : 'border-neutral-200 dark:border-neutral-700 hover:border-brand-300'
                        }`}
                    >
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{rate}</div>
                    </button>
                ))}
            </div>

            <details className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                <summary className="cursor-pointer text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('campaign.advanced_speed')}
                </summary>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs text-neutral-500">{t('campaign.msg_per_minute')}</label>
                        <input
                            type="number"
                            min={1}
                            max={60}
                            value={mpm}
                            onChange={(e) => updateCustom('messages_per_minute', Number(e.target.value))}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-neutral-500">{t('campaign.chunk_size')}</label>
                        <input
                            type="number"
                            min={10}
                            max={1000}
                            value={settings.chunk_size ?? 100}
                            onChange={(e) => updateCustom('chunk_size', Number(e.target.value))}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-neutral-500">{t('campaign.chunk_pause')}</label>
                        <input
                            type="number"
                            min={0}
                            max={600}
                            value={settings.chunk_pause_seconds ?? 60}
                            onChange={(e) => updateCustom('chunk_pause_seconds', Number(e.target.value))}
                            className={inputClass}
                        />
                    </div>
                </div>
            </details>
        </div>
    );
}

function InlineSchedulePanel({ data, setData, errors }) {
    const { t } = useTranslation();

    return (
        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6 space-y-3">
            <h3 className="font-medium text-neutral-800 dark:text-neutral-200">{t('campaign.when_send')}</h3>
            <div className="flex flex-wrap gap-2">
                {[
                    ['now', t('campaign.send_now')],
                    ['scheduled', t('campaign.send_later')],
                ].map(([mode, label]) => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => setData('send_mode', mode)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                            data.send_mode === mode
                                ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-700'
                                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {data.send_mode === 'scheduled' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-2">
                    <div>
                        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            {t('campaign.send_at')}
                        </label>
                        <DatePicker
                            mode="datetime"
                            value={data.schedule_at}
                            onChange={(v) => setData('schedule_at', v)}
                            className="mt-1"
                            error={!!errors.schedule_at}
                        />
                        <FieldError message={errors.schedule_at} />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            {t('campaign.timezone')}
                        </label>
                        <TimezonePicker
                            value={data.timezone}
                            onChange={(tz) => setData('timezone', tz)}
                            className="mt-1"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function ScheduleStep({ data, setData, errors }) {
    const { t } = useTranslation();
    // Build a friendly preview that proves what UTC instant we'll persist.
    const tz = data.timezone || browserTz();
    const utcIso = data.schedule_at ? tzLocalToUtcIso(data.schedule_at, tz) : null;
    const localPreview = utcIso ? formatInTz(utcIso, tz) : null;
    const browserPreview =
        utcIso && tz !== browserTz() ? formatInTz(utcIso, browserTz()) : null;

    return (
        <>
            <h3 className="font-medium text-neutral-800 dark:text-neutral-200">{t('campaign.step_schedule')}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('campaign.schedule_help')}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('campaign.send_at')}</label>
                    <DatePicker
                        mode="datetime"
                        value={data.schedule_at}
                        onChange={(v) => setData('schedule_at', v)}
                        className="mt-1"
                        error={!!errors.schedule_at}
                    />
                    <FieldError message={errors.schedule_at} />
                </div>
                <div>
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('campaign.timezone')}</label>
                    <TimezonePicker
                        value={data.timezone}
                        onChange={tz => setData('timezone', tz)}
                        className="mt-1"
                    />
                    <FieldError message={errors.timezone} />
                </div>
            </div>

            {localPreview && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                    <div className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('campaign.will_be_sent_at')}
                    </div>
                    <div className="mt-1">
                        <span className="font-mono">{localPreview}</span>
                    </div>
                    {browserPreview && (
                        <div className="mt-0.5 text-[11px] text-blue-700 dark:text-blue-300">
                            <Trans
                                i18nKey="campaign.which_is_browser"
                                values={{ time: browserPreview }}
                                components={{ time: <span className="font-mono" /> }}
                            />
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

function ReviewStep({
    data,
    preview,
    selectedTemplate,
    slots,
    contactTokens,
    campaign,
    testTo,
    setTestTo,
    sendTest,
}) {
    const { t } = useTranslation();
    const channelLabel = CHANNEL_META[data.channel]?.label ?? data.channel;

    return (
        <>
            <h3 className="font-medium text-neutral-800 dark:text-neutral-200">{t('campaign.review_confirm')}</h3>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {[
                    [t('common.name'), data.name || '—'],
                    [t('campaign.col_channel'), channelLabel],
                    [t('campaign.audience'), `${data.audience_type}${data.audience_ref ? ` · ${data.audience_ref}` : ''}`],
                    [t('campaign.reachable_contacts'), preview.deliverable.toLocaleString()],
                    [
                        t('campaign.step_schedule'),
                        data.schedule_at
                            ? `${formatInTz(
                                  tzLocalToUtcIso(data.schedule_at, data.timezone),
                                  data.timezone,
                              )} (${data.timezone})`
                            : t('campaign.on_demand'),
                    ],
                ].map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                        <dt className="w-32 shrink-0 font-medium text-neutral-500 dark:text-neutral-400">{k}</dt>
                        <dd className="text-neutral-900 dark:text-neutral-100">{v}</dd>
                    </div>
                ))}
                {data.channel === 'whatsapp' && data.template_ref?.name && (
                    <div className="flex gap-3 sm:col-span-2">
                        <dt className="w-32 shrink-0 font-medium text-neutral-500 dark:text-neutral-400">{t('campaign.template')}</dt>
                        <dd className="text-neutral-900 dark:text-neutral-100 font-mono">
                            {data.template_ref.name} ({data.template_ref.language})
                        </dd>
                    </div>
                )}
                {data.channel === 'email' && (data.payload_json.from_email || data.payload_json.from_name) && (
                    <div className="flex gap-3 sm:col-span-2">
                        <dt className="w-32 shrink-0 font-medium text-neutral-500 dark:text-neutral-400">{t('campaign.from')}</dt>
                        <dd className="text-neutral-900 dark:text-neutral-100">
                            {data.payload_json.from_name && <span>{data.payload_json.from_name} </span>}
                            {data.payload_json.from_email && (
                                <span className="text-neutral-500 dark:text-neutral-400">&lt;{data.payload_json.from_email}&gt;</span>
                            )}
                        </dd>
                    </div>
                )}
                {data.channel === 'email' && data.payload_json.reply_to && (
                    <div className="flex gap-3 sm:col-span-2">
                        <dt className="w-32 shrink-0 font-medium text-neutral-500 dark:text-neutral-400">{t('campaign.reply_to_short')}</dt>
                        <dd className="text-neutral-900 dark:text-neutral-100">{data.payload_json.reply_to}</dd>
                    </div>
                )}
                {data.channel === 'email' && (
                    <div className="flex gap-3 sm:col-span-2">
                        <dt className="w-32 shrink-0 font-medium text-neutral-500 dark:text-neutral-400">{t('campaign.tracking')}</dt>
                        <dd className="text-neutral-900 dark:text-neutral-100 space-x-2">
                            {data.payload_json.track_opens && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                    {t('campaign.opens')}
                                </span>
                            )}
                            {data.payload_json.track_clicks && (
                                <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                                    {t('campaign.clicks')}
                                </span>
                            )}
                            {!data.payload_json.track_opens && !data.payload_json.track_clicks && (
                                <span className="text-neutral-400">{t('campaign.disabled')}</span>
                            )}
                        </dd>
                    </div>
                )}
            </dl>

            {/* Test send (edit-mode only — needs a saved campaign id) */}
            {campaign?.id && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 mt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        <Eye className="h-4 w-4" /> {t('campaign.send_a_test')}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t('campaign.send_test_desc')}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <input
                                type="text"
                                placeholder={t('campaign.phone_placeholder')}
                                value={testTo.phone_e164}
                                onChange={(e) => setTestTo((s) => ({ ...s, phone_e164: e.target.value }))}
                                className={inputClass}
                            />
                            {testTo.phone_e164 && !testTo.phone_e164.startsWith('+') && !/^01[3-9]\d{8}$/.test(testTo.phone_e164) && (
                                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                    {t('campaign.intl_number_hint')}
                                </p>
                            )}
                        </div>
                        <input
                            type="email"
                            placeholder={t('common.email')}
                            value={testTo.email}
                            onChange={(e) => setTestTo((s) => ({ ...s, email: e.target.value }))}
                            className={inputClass}
                        />
                    </div>
                    <button
                        type="button"
                        disabled={testTo.sending || (!testTo.phone_e164 && !testTo.email)}
                        onClick={sendTest}
                        className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 dark:bg-neutral-700 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {testTo.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {t('campaign.send_test')}
                    </button>
                    {testTo.result && (
                        <p
                            className={`text-xs ${
                                testTo.result.ok
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400'
                            } flex items-center gap-1`}
                        >
                            {testTo.result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                            {testTo.result.message}
                        </p>
                    )}
                </div>
            )}
        </>
    );
}

// ─── Reusable bits ───────────────────────────────────────────────────────────

function SearchableSelect({ label, items, value, onChange, placeholder, emptyHint }) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);

    const filtered = useMemo(
        () => items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())),
        [items, q],
    );

    const selected = items.find((i) => String(i.id) === String(value));

    return (
        <div className="relative">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
            <div className="mt-1 relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                    type="text"
                    value={open ? q : selected?.label ?? ''}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        setOpen(true);
                        setQ('');
                    }}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder={placeholder}
                    className={`${inputClass} pl-9`}
                />
            </div>
            {open && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg">
                    {filtered.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-neutral-500">{emptyHint}</p>
                    ) : (
                        filtered.map((i) => (
                            <button
                                key={i.id}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onChange(String(i.id));
                                    setOpen(false);
                                }}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 ${
                                    String(i.id) === String(value)
                                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                                        : ''
                                }`}
                            >
                                <span>{i.label}</span>
                                {i.meta && <span className="text-xs text-neutral-400">{i.meta}</span>}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function BodyTextarea({
    label,
    field,
    value,
    onChange,
    placeholder,
    rows = 4,
    mono = false,
    contactTokens,
    onInsertToken,
    error,
}) {
    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
                <TokenPicker tokens={contactTokens} onPick={onInsertToken} />
            </div>
            <textarea
                rows={rows}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`${inputClass} resize-none ${mono ? 'font-mono' : ''}`}
            />
            <FieldError message={error} />
        </div>
    );
}

function TokenPicker({ tokens, onPick }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
                <Variable className="h-3 w-3" /> {t('campaign.insert_variable')}
            </button>
            {open && (
                <div
                    className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg"
                    onMouseLeave={() => setOpen(false)}
                >
                    {tokens.map((token) => (
                        <button
                            key={token.key}
                            type="button"
                            onClick={() => {
                                onPick(token.key);
                                setOpen(false);
                            }}
                            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700"
                        >
                            <span>{token.label}</span>
                            <span className="font-mono text-neutral-400">{token.key}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ToggleSwitch({ checked, onChange, label, description }) {
    return (
        <div className="flex items-start gap-3">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                    checked ? 'bg-brand-600' : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
            >
                <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                        checked ? 'translate-x-4' : 'translate-x-0'
                    }`}
                />
            </button>
            <div>
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</div>
                {description && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{description}</div>
                )}
            </div>
        </div>
    );
}

function SlotInput({ slot, label, mediaKind, contactTokens, onChange }) {
    const { t } = useTranslation();
    // Header media (image / video / document) gets an Upload-or-Link picker.
    if (mediaKind) {
        return <MediaSlotInput slot={slot} label={label} mediaKind={mediaKind} onChange={onChange} />;
    }
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-neutral-600 dark:text-neutral-300">{label}</span>
                {!mediaKind && (
                    <div className="flex gap-1">
                        <button
                            type="button"
                            onClick={() => onChange({ kind: 'static' })}
                            className={`rounded-md px-2 py-0.5 text-xs ${
                                slot.kind === 'static'
                                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                                    : 'text-neutral-500'
                            }`}
                        >
                            {t('campaign.slot_static')}
                        </button>
                        <button
                            type="button"
                            onClick={() => onChange({ kind: 'variable' })}
                            className={`rounded-md px-2 py-0.5 text-xs ${
                                slot.kind === 'variable'
                                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                                    : 'text-neutral-500'
                            }`}
                        >
                            {t('campaign.slot_variable')}
                        </button>
                    </div>
                )}
            </div>
            {slot.kind === 'variable' ? (
                <select
                    value={slot.value}
                    onChange={(e) => onChange({ value: e.target.value })}
                    className={inputClass}
                >
                    <option value="">{t('campaign.select_contact_field')}</option>
                    {contactTokens.map((token) => (
                        <option key={token.key} value={token.key}>
                            {token.label}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    type="text"
                    value={slot.value}
                    onChange={(e) => onChange({ value: e.target.value })}
                    placeholder={mediaKind ? `https://example.com/file.${mediaKind === 'image' ? 'jpg' : mediaKind === 'video' ? 'mp4' : 'pdf'}` : t('campaign.enter_value')}
                    className={inputClass}
                />
            )}
        </div>
    );
}

/**
 * Header media slot with two tabs: Upload (stores the file and uses its public
 * URL) or Link (paste a URL). Either way the slot value ends up as a public URL
 * that Meta fetches when sending the template header.
 */
function MediaSlotInput({ slot, label, mediaKind, onChange }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState('upload');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef(null);

    const accept = mediaKind === 'image' ? 'image/*' : mediaKind === 'video' ? 'video/*' : 'application/pdf';
    const ext = mediaKind === 'image' ? 'jpg' : mediaKind === 'video' ? 'mp4' : 'pdf';

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('collection', 'campaign-media');
            const res = await axios.post(route('client.media.store'), fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            onChange({ value: res.data.url });
        } catch (err) {
            setError(err?.response?.data?.error ?? t('campaign.upload_failed'));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            <span className="text-xs text-neutral-600 dark:text-neutral-300">{label}</span>

            <div className="flex w-fit gap-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5">
                {[
                    ['upload', t('campaign.tab_upload'), Upload],
                    ['link', t('campaign.tab_link'), LinkIcon],
                ].map(([key, text, Icon]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                            tab === key
                                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" /> {text}
                    </button>
                ))}
            </div>

            {tab === 'upload' ? (
                <div className="space-y-1.5">
                    <input ref={fileRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 px-3 py-2.5 text-sm text-neutral-600 dark:text-neutral-300 hover:border-brand-400 disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? t('campaign.uploading') : t('campaign.upload_media', { media: t(`campaign.media_${mediaKind}`, mediaKind) })}
                    </button>
                    {error && (
                        <p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <AlertCircle className="h-3.5 w-3.5" /> {error}
                        </p>
                    )}
                </div>
            ) : (
                <input
                    type="text"
                    value={slot.value}
                    onChange={(e) => onChange({ value: e.target.value })}
                    placeholder={`https://example.com/file.${ext}`}
                    className={inputClass}
                />
            )}

            {slot.value && !uploading && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <a href={slot.value} target="_blank" rel="noreferrer" className="truncate underline">
                        {mediaKind === 'image' ? t('campaign.image_set') : mediaKind === 'video' ? t('campaign.video_set') : t('campaign.file_set')}
                    </a>
                </div>
            )}

            {mediaKind === 'image' && slot.value && (
                <img
                    src={slot.value}
                    alt=""
                    className="mt-1 max-h-28 rounded-lg border border-neutral-200 dark:border-neutral-700 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            )}
        </div>
    );
}

function PreviewPane({ data, selectedTemplate, slots, contactTokens, audiencePreview, senders = [], isUnofficialSender = false }) {
    const { t } = useTranslation();
    let content = null;

    if (data.channel === 'whatsapp') {
        if (isUnofficialSender) {
            content = (
                <div className="space-y-2">
                    {data.payload_json.media_url && (
                        <img
                            src={data.payload_json.media_url}
                            alt=""
                            className="max-h-40 rounded-lg border border-neutral-200 dark:border-neutral-700 object-cover"
                        />
                    )}
                    <div className="rounded-2xl rounded-tl-none bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-100 shadow-sm whitespace-pre-line">
                        {data.payload_json.body || (data.payload_json.media_url ? '📷' : '—')}
                    </div>
                </div>
            );
        } else if (selectedTemplate) {
            const templateBody = pickPreviewText(selectedTemplate.components ?? []);
            const rendered = renderPreview(templateBody, slots, contactTokens);
            content = rendered && rendered !== templateBody ? (
                <div className="rounded-2xl rounded-tl-none bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-100 shadow-sm whitespace-pre-line">
                    {rendered}
                </div>
            ) : (
                <TemplatePreview components={selectedTemplate.components ?? []} />
            );
        } else {
            content = (
                <div className="text-sm text-neutral-500">—</div>
            );
        }
    } else if (data.channel === 'sms') {
        content = (
            <div className="rounded-2xl rounded-tl-none bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-100 whitespace-pre-line">
                {data.payload_json.body || '—'}
            </div>
        );
    } else if (data.channel === 'email') {
        content = (
            <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-neutral-500">{t('campaign.subject')}</div>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {data.payload_json.subject || '—'}
                </div>
                <div
                    className="prose prose-sm max-w-none dark:prose-invert text-sm text-neutral-800 dark:text-neutral-200"
                    dangerouslySetInnerHTML={{ __html: data.payload_json.body || '—' }}
                />
            </div>
        );
    }

    return (
        <aside className="space-y-4">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    <Eye className="h-4 w-4" /> {t('campaign.live_preview')}
                </div>
                <div className="mt-3">{content}</div>
                <p className="mt-3 text-xs text-neutral-500">
                    <Trans
                        i18nKey="campaign.variables_hint"
                        components={{ field: <span className="font-mono" /> }}
                    />
                </p>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 space-y-1 text-xs">
                <div className="font-medium text-neutral-700 dark:text-neutral-200">{t('campaign.at_a_glance')}</div>
                <div className="flex justify-between">
                    <span className="text-neutral-500">{t('campaign.col_channel')}</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-100">
                        {CHANNEL_META[data.channel]?.label ?? data.channel}
                    </span>
                </div>
                {data.channel === 'whatsapp' && data.whatsapp_phone_number_id && (() => {
                    const p = senders.find((n) => n.phone_number_id === data.whatsapp_phone_number_id);
                    return p ? (
                        <div className="flex justify-between gap-3">
                            <span className="text-neutral-500">{t('campaign.from')}</span>
                            <span className="text-right font-medium text-neutral-800 dark:text-neutral-100">
                                {p.display_phone}
                            </span>
                        </div>
                    ) : null;
                })()}
                {data.channel === 'email' && data.payload_json?.from_email && (
                    <div className="flex justify-between gap-3">
                        <span className="text-neutral-500">{t('campaign.from')}</span>
                        <span className="text-right font-medium text-neutral-800 dark:text-neutral-100 truncate max-w-[10rem]">
                            {data.payload_json.from_name
                                ? `${data.payload_json.from_name} <${data.payload_json.from_email}>`
                                : data.payload_json.from_email}
                        </span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-neutral-500">{t('campaign.audience')}</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-100">
                        {data.audience_type}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-neutral-500">{t('campaign.reachable')}</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {audiencePreview.deliverable.toLocaleString()}
                    </span>
                </div>
                {data.schedule_at && (
                    <div className="flex justify-between gap-3">
                        <span className="text-neutral-500">{t('campaign.step_schedule')}</span>
                        <span className="text-right font-medium text-neutral-800 dark:text-neutral-100">
                            {formatInTz(
                                tzLocalToUtcIso(data.schedule_at, data.timezone),
                                data.timezone,
                            )}
                        </span>
                    </div>
                )}
            </div>
        </aside>
    );
}

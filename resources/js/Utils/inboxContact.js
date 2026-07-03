/**
 * Display name for inbox conversation list / header.
 */
export function contactDisplayName(contact, externalThreadId) {
    const name = `${contact?.first_name ?? ''} ${contact?.last_name ?? ''}`.trim();
    if (name && name !== 'WhatsApp') {
        return name;
    }

    const phone = contact?.phone_e164;
    if (phone) {
        const digits = phone.replace(/\D/g, '');
        // Valid E.164 lengths; skip garbage IDs stored as phones
        if (digits.length >= 10 && digits.length <= 13) {
            return phone;
        }
    }

    if (externalThreadId?.includes('@lid')) {
        const id = externalThreadId.split('@')[0];

        return `WhatsApp ···${id.slice(-4)}`;
    }

    if (externalThreadId?.includes('@c.us')) {
        const id = externalThreadId.split('@')[0];
        if (id.length >= 10 && id.length <= 13) {
            return `+${id}`;
        }
    }

    if (name) {
        return name;
    }

    return 'Unknown';
}

/** Valid phone for subtitle, or null when hidden / garbage. */
export function contactPhoneSubtitle(contact, externalThreadId) {
    const phone = contact?.phone_e164;
    if (phone) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 13) {
            return phone;
        }
    }

    if (externalThreadId?.includes('@lid')) {
        return null;
    }

    return null;
}

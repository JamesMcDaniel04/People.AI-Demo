const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'account';

export class DatasetAnonymizer {
  constructor(options = {}) {
    this.maskNames = options.maskNames ?? false;
    this.maskEmails = options.maskEmails ?? true;
  }

  apply(dataset, context = {}) {
    if (!dataset) return dataset;
    const clone = JSON.parse(JSON.stringify(dataset));
    const accountName = context.accountName || clone?.accountInfo?.accountName || 'account';
    const accountSlug = context.accountSlug || slugify(accountName);
    const safeDomain = context.safeDomain || `${accountSlug}.demo`;
    const aliasCache = new Map();

    const aliasFor = (name, hint) => {
      if (!this.maskNames || !name) {
        return name;
      }
      const key = `${name}|${hint || ''}`;
      if (aliasCache.has(key)) {
        return aliasCache.get(key);
      }
      const index = aliasCache.size;
      const labelBase = hint || 'Contact';
      const label = `${labelBase} ${String.fromCharCode(65 + (index % 26))}`;
      aliasCache.set(key, label);
      return label;
    };

    const sanitizeEmail = (value, hint) => {
      if (!value || !this.maskEmails) {
        return value;
      }
      const local = String(value).split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '') || 'user';
      return `${local}@${safeDomain}`;
    };

    if (Array.isArray(clone.stakeholders)) {
      clone.stakeholders = clone.stakeholders.map((stakeholder) => ({
        ...stakeholder,
        email: sanitizeEmail(stakeholder.email, stakeholder.persona_type || stakeholder.role),
        name: aliasFor(stakeholder.name, stakeholder.persona_type || stakeholder.role)
      }));
    }

    if (Array.isArray(clone.emails)) {
      clone.emails = clone.emails.map((thread, index) => ({
        ...thread,
        thread_id: thread.thread_id || `THREAD-${index + 1}`,
        messages: (thread.messages || []).map((message) => ({
          ...message,
          from: sanitizeEmail(message.from, 'Email Sender'),
          to: Array.isArray(message.to)
            ? message.to.map(addr => sanitizeEmail(addr, 'Email Recipient'))
            : sanitizeEmail(message.to, 'Email Recipient')
        }))
      }));
    }

    if (Array.isArray(clone.calls)) {
      clone.calls = clone.calls.map((call, index) => ({
        ...call,
        call_id: call.call_id || `CALL-${index + 1}`,
        participants: (call.participants || []).map(participant => aliasFor(participant, 'Participant')),
        transcript: (call.transcript || []).map(turn => ({
          ...turn,
          speaker: aliasFor(turn.speaker, 'Speaker')
        }))
      }));
    }

    if (Array.isArray(clone.calendar)) {
      clone.calendar = clone.calendar.map((event) => ({
        ...event,
        attendees: (event.attendees || []).map(addr => sanitizeEmail(addr, 'Calendar Attendee'))
      }));
    }

    if (Array.isArray(clone.documents)) {
      clone.documents = clone.documents.map((doc) => ({
        ...doc,
        author: aliasFor(doc.author, doc.type || 'Author')
      }));
    }

    if (Array.isArray(clone.crm)) {
      clone.crm = clone.crm.map((record) => ({
        ...record,
        owner: aliasFor(record.owner, 'Owner')
      }));
    }

    return clone;
  }
}

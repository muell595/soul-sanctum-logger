const MODULE_ID = "soul-sanctum-logger";

// Utility: sanitize or pick fields relevant to store/forward
function pickChatData(message) {
  // message may be a ChatMessage document or a plain object depending on hook timing/version.
  // Prefer duck-typing to avoid instanceof issues across Foundry versions.
  const m = (message && typeof message.toObject === "function") ? message.toObject(false) : (message || {});

  // Normalize author/user fields when possible
  if (m) {
    m.user = (typeof m.author === "object") ? (m.author.id ?? m.author) : m.author;
    if (m.author && typeof m.author === "object" && m.author.name) {
      m._authorName = m.author.name;
    }
  }

  // Helper function to safely parse a roll entry that may be a stringified JSON or an object
  function parseRollEntry(raw) {
    try {
      if (!raw) return null;
      const obj = (typeof raw === "string") ? JSON.parse(raw) : raw;
      return obj;
    } catch (e) {
      return null;
    }
  }

  // Extract detailed roll info from m.rolls or other possible locations
  function extractRollInfo() {
    try {
      if (!m) return null;

      // 1) If there's an array of rolls (common in ChatMessage5e)
      if (Array.isArray(m.rolls) && m.rolls.length) {
        // parse each entry if it's a JSON string
        const parsed = m.rolls.map(parseRollEntry);
        // pick first roll as primary (mirrors prior examples)
        const primary = parsed[0] ?? null;
        const total = primary?.total ?? primary?._total ?? m.total ?? null;
        const formula = primary?.formula ?? null;
        const evaluated = primary?.evaluated ?? m.evaluated ?? null;
        const dice = primary?.terms
          ? primary.terms
              .filter(t => t.class === "Die")
              .map(d => ({
                faces: d.faces ?? d.options?.faces ?? null,
                number: d.number ?? null,
                results: (Array.isArray(d.results) ? d.results.map(r => r.result ?? r) : null)
              }))
          : (primary?.dice ?? null);

        return {
          total: (typeof total === "number") ? total : (Number.isFinite(+total) ? +total : null),
          formula,
          evaluated,
          dice,
          raw: primary ?? parsed
        };
      }

      // 2) If roll info exists directly on the message as an object
      if (m.roll && typeof m.roll === "object") {
        const r = m.roll;
        return {
          total: r.total ?? r._total ?? null,
          formula: r.formula ?? null,
          evaluated: r.evaluated ?? null,
          dice: r.terms ? r.terms.filter(t => t.class === "Die").map(d => ({
            faces: d.faces ?? null,
            number: d.number ?? null,
            results: (Array.isArray(d.results) ? d.results.map(rr => rr.result ?? rr) : null)
          })) : (r.dice ?? null),
          raw: r
        };
      }

      // 3) If message provides a top-level total
      if (m.total || m._total) {
        return {
          total: m.total ?? m._total ?? null,
          formula: m.formula ?? null,
          evaluated: m.evaluated ?? null,
          dice: null,
          raw: m
        };
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // Build the returned payload including every field
  return {
    messageId: m._id || m.id || null,
    authorID: m.author?.id ?? m.author ?? null,
    username: (() => {
      try {
        if (m._authorName) return m._authorName;
        const authorId = m.author?.id ?? m.author ?? null;
        const u = authorId && (typeof game !== 'undefined' && game.users) ? game.users.get(authorId) : null;
        return u ? u.name : null;
      } catch (e) {
        return null;
      }
    })(),
    user: m.user ?? null,
    speaker: m.speaker ?? null,
    content: m.content ?? null,
    flavor: m.flavor ?? null,
    // roll: return detailed parsed roll object (or null)
    roll: extractRollInfo(),
    // keep top-level numeric total for convenience (mirror older code)
    rollTotal: (() => {
      const r = extractRollInfo();
      return r ? r.total : null;
    })(),
    whisper: m.whisper ?? null,
    blind: m.blind ?? false,
    timestamp: m.flags?.core?.time ? m.flags.core.time : (m.timestamp ? (typeof m.timestamp === "number" ? new Date(+m.timestamp).toISOString() : m.timestamp) : (new Date()).toISOString()),
    flags: m.flags || {},
    emote: m.emote ?? false,
    sound: m.sound ?? null,
    style: m.style ?? null,
    system: m.system ?? null,
    type: m.type ?? null,
    title: m.title ?? null,
    _stats: m._stats ?? null,
    // raw message object for debug if needed (be careful sending large objects externally)
    _raw: m
  };
}


// Hook into ChatMessage creation
Hooks.on('createChatMessage', (message, options, userId) => {
  try {
    const payload = pickChatData(message);
    payload.foundryversion = game.data?.version ?? game.version?.string ?? null;
    payload.world = game.world?.id ?? game.world?.name ?? null;
    payload.clientTimestamp = (new Date()).toISOString();
    payload.module_id = MODULE_ID;
    console.log("Soul Sanctum Logger - Chat Message Payload:", payload);
    // sendToEndpoint(payload); // enable as needed
  } catch (err) {
    console.error("Soul Sanctum Logger - Error processing chat message:", err);
  }
});

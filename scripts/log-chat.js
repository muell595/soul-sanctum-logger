const MODULE_ID = "soul-sanctum-logger";

// Utility: sanitize or pick fields relevant to store/forward
function pickChatData(message) {
  // message may be a ChatMessage document or a plain object depending on hook timing/version.
  // Prefer duck-typing to avoid instanceof issues across Foundry versions.
  const m = (message && typeof message.toObject === "function") ? message.toObject(false) : (message || {});

  if (m) {
      m.user = (typeof m.author === "object") ? (m.author.id ?? m.author) : m.author;
      if (m.author && typeof m.author === "object" && m.author.name) {
          m._authorName = m.author.name;
      }
    }
  // Relevant Fields
  return {
    messageId: m._id || m.id || null,
      // userID: m.author?.id ?? m.author ?? m.user ?? m.userId ?? null,
    authorID: m.author?.id ?? m.author ?? null,
    username: (() => {
      try {
        // Prefer an embedded author name if present, else lookup by ID
        if (m._authorName) return m._authorName;
        const authorId = m.author?.id ?? m.author ?? null;
        const u = authorId ? game.users.get(authorId) : null;
        return u ? u.name : null;
      } catch (e) {
        return null;
      }
    })(),
    speaker: m.speaker || null,
    content: m.content || null,
    flavor: m.flavor || null,
    roll: m.roll ? (typeof m.roll === "object" ? m.roll.total ?? null : m.roll) : null,
    whisper: m.whisper || null,
    blind: m.blind || false,
    timestamp: m.flags?.core?.time ? m.flags.core.time : (new Date()).toISOString(),
    flags: m.flags || {},
    emote: m.emote || false,
    sound: m.sound || null
  };
}

async function sendToEndpoint(payload) {
    const endpoint = "http://192.168.0.236:5678/webhook-test/roll20/chat"; // N8N URL
    const headers = { "Content-Type": "application/json" };

    try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true
    });

    const success = resp.ok;
    let responseText = null;
    try { responseText = await resp.text(); } catch {}

    Hooks.callAll(`${MODULE_ID}.chatSent`, {
      success,
      status: resp.status,
      response: responseText,
      originalPayload: payload,
      error: null
    });

    return success;
  } catch (err) {
    Hooks.callAll(`${MODULE_ID}.chatSent`, {
      success: false,
      status: null,
      response: null,
      originalPayload: payload,
      error: err
    });
    console.warn(`${MODULE_ID} | Failed to forward chat message:`, err);
    return false;
  }
}

// Hook into chat message creation
    Hooks.on('createChatMessage', (chatMessage, options, userId) => {
        try {
            const payload = pickChatData(chatMessage);
            payload.foundryversion = game.data.version ?? game.version?.string ?? null;
            payload.world = game.world?.id ?? game.world?.name ?? null;
            payload.clientTimestamp = (new Date()).toISOString();
            console.log("Soul Sanctum Logger - Chat Message Payload:", payload);
            sendToEndpoint(payload);
        } catch (err) {
            console.error("Soul Sanctum Logger - Error processing chat message:", err);
        }
        
    });
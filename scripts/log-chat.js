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
// Originally got this message:
// "This has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource."
// Fixed it in N8N by enabling CORS in the webhook settings.
async function sendToEndpoint(payload) {
    // const endpoint = "https://n8n.muellervault.net/webhook/roll20/chat"; // PROD. Goes to public schema in postgres. is PROD instance of N8N's webhook.
    // const endpoint = "https://n8n.muellervault.net/webhook/roll20/test/chat"; // TEST. Goes to test schema in postgres. Is the PROD instance of N8N's webhook.
    const endpoint = "https://n8n.muellervault.net/webhook-test/roll20/test/chat"; // TEST DEBUG. Goes to test schema in postgres. Is the TEST instance of N8N's webhook.
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

// GOING WITH 5e ChatMessage for now. Need to test if it sends different info.

// Hook into chat message creation
    // Hooks.on('createChatMessage', (chatMessage, options, userId) => {
    //     try {
    //         const payload = pickChatData(chatMessage);
    //         payload.foundryversion = game.data.version ?? game.version?.string ?? null;
    //         payload.world = game.world?.id ?? game.world?.name ?? null;
    //         payload.clientTimestamp = (new Date()).toISOString();
    //         payload.module_id = MODULE_ID;
    //         console.log("Soul Sanctum Logger - Chat Message Payload:", payload);
    //         sendToEndpoint(payload);
    //     } catch (err) {
    //         console.error("Soul Sanctum Logger - Error processing chat message:", err);
    //     }
        
    // });

// Hook into ChatMessage5e. Maybe this sends different info...?
    // Hooks.on('createChatMessage', (ChatMessage5e, options, userId) => {
    //     try {
    //         const payload = pickChatData(ChatMessage5e);
    //         payload.foundryversion = game.data.version ?? game.version?.string ?? null;
    //         payload.world = game.world?.id ?? game.world?.name ?? null;
    //         payload.clientTimestamp = (new Date()).toISOString();
    //         payload.module_id = MODULE_ID;
    //         console.log("Soul Sanctum Logger - Chat Message Payload:", payload);
    //         sendToEndpoint(payload);
    //     } catch (err) {
    //         console.error("Soul Sanctum Logger - Error processing chat message:", err);
    //     }
        
    // });  

    Hooks.on('createChatMessage', (message, options, userId) => {
  try {
    const m = (message && typeof message.toObject === "function") ? message.toObject(false) : message;
    console.groupCollapsed("Chat message inspection");
    console.dir(m, { depth: null });
    console.log("m.rolls:", m.rolls);
    if (Array.isArray(m.rolls) && m.rolls[0]) {
      console.dir(m.rolls[0], { depth: null });
      // show common total fields
      console.log("possible totals:", m.rolls[0].total, m.rolls[0]._total, m.rolls[0].result?.total);
    }
    console.groupEnd();
  } catch (e) { console.error(e); }
});
const MODULE_ID = "soul-sanctum-logger";
const SETTING_ENDPOINT = "endpointURL";
const SETTING_APIKEY = "apiKey";

Hooks.once('init', () => {
// Register a simple setting for the endpoint (keeps it editable in Settings)
    game.settings.register(MODULE_ID, SETTING_ENDPOINT, {
        name: "Chat Forwarder Endpoint",
        hint: "The URL to which chat messages will be forwarded.", // Should be the N8N webhook URL. I think.
        scope: "world",
        config: true,
        default: "",
        type: String
    });
// Optional API key heaer stored as world setting (visible to GMs)
    game.settings.register(MODULE_ID, SETTING_APIKEY, {
        name: "Chat Forwarder API Key",
        hint: "Optional API key to include in the request headers. Server muist validate. Keep blank to disable.",
        scope: "world",
        config: true,
        default: "",
        type: String
    });
});

// Utility: sanitize or pick fields relevant to store/forward
function pickChatData(message) {
  // message may be a ChatMessage document or a plain object depending on hook timing/version.
  // Prefer duck-typing to avoid instanceof issues across Foundry versions.
  const m = (message && typeof message.toObject === "function") ? message.toObject(false) : (message || {});

  // Normalize migrated fields (compat between ChatMessage#author and legacy ChatMessage#user)
  if (m) {
    // If the newer `author` exists but `user` does not, populate `user` for backward compatibility
    if (m.author && !m.user) {
      m.user = (typeof m.author === "object") ? (m.author.id ?? m.author) : m.author;
    }

    // If `user` exists but `author` does not, create a minimal `author` object
    if (!m.author && m.user) {
      m.author = { id: m.user, name: null };
    }

    // If `author` is an object with a name, expose it for convenience
    if (m.author && typeof m.author === "object" && m.author.name) {
      m._authorName = m.author.name;
    }
  }

  // Relevant Fields
  return {
    messageId: m._id || m.id || null,
    userID: m.author?.id ?? m.author ?? m.user ?? m.userId ?? null,
    username: (() => {
      try {
        // Prefer an embedded author name if present, else lookup by ID
        if (m._authorName) return m._authorName;
        const authorId = m.author?.id ?? m.author ?? m.user ?? m.userId ?? null;
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
    flags: m.flags || {}
  };
}
 
// Send POST wit hfetch. Keep errors non-blocking.
async function sendToEndpoint(payload) {
    const endpoint = game.settings.get(MODULE_ID, SETTING_ENDPOINT)?.trim();
    if (!endpoint) return;
        const apiKey = game.settings.get(MODULE_ID, SETTING_APIKEY)?.trim();
        
        try {
            const headers = { "Content-Type": "application/json" };
            if (apiKey) headers["x-api-key"] = apiKey;

            await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                keepalive: true
            });
        } catch (err) {
            console.warn(`${MODULE_ID} | Failed to forward chat message:`, err);
        }
    }

    // Hook into chat message creation
    Hooks.on('createChatMessage', (chatMessage, options, userId) => {
        try {
            const payload = pickChatData(chatMessage);
            payload.foundryversion = game.data.version ?? game.version?.string ?? null;
            payload.world = game.world?.id ?? game.world?.name ?? null;
            payload.clientTimestamp = (new Date()).toISOString();
            // Non-blocking fire and forget
            sendToEndpoint(payload);
        } catch (err) {
            console.error(`${MODULE_ID} | Error capturing chat message:`, err);
        }
    });
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
    const m = message instanceof foundry.documents.BaseDocument ? message.toObject(false) : message;
    // Relevant Fields
    return {
        messageId: m._id || m.id || null,
        userID: m.user || m.userId || null,
        username: (() => {
            try {
                const u = game.users.get(m.user || m.userId) || null;
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
        timestamp: m.flags && m.flags?.core?.time ? m.flags.core.time : (new Date()).toISOString(),
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
const MODULE_ID = "soul-sanctum-logger";









// Originally got this message:
// "This has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource."
// Fixed it in N8N by enabling CORS in the webhook settings.
async function sendToEndpoint(payload) {
    // const endpoint = "https://n8n.muellervault.net/webhook/roll20/rolls"; // PROD. Goes to public schema in postgres. is production instance of N8N's webhook.
    const endpoint = "https://n8n.muellervault.net/webhook/roll20/test/rolls"; // TEST. Goes to test schema in postgres. Is the prod instance of N8N's webhook.
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

// Hook into die roll creation

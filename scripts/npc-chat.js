/********************************************************************
 *  npc-chat.js – Foundry VTT module that adds a persistent NPC‑chat UI
 *
 *  Updated for Foundry Core 13+ using the V2 Application framework.
 ********************************************************************/

/* ------------------------------------------------------------------
 *  CONFIGURATION – edit these constants to match your NPC
 * ------------------------------------------------------------------ */
const NPC_NAME = "Spren";                       // Display name shown in the UI
const NPC_ID   = "Actor.UWdXecZvjKWQHLrh";      // Optional: reliable actor ID

/* ------------------------------------------------------------------
 *  IMPORT V2 core classes / utilities
 * ------------------------------------------------------------------ */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api
const { mergeObject } = foundry.utils;

/* ------------------------------------------------------------------
 *  UI CLASS – the actual chat window (extends V2 Application)
 * ------------------------------------------------------------------ */
export default class NpcChatUI extends ApplicationV2 {

  /** @override – define window options */
  static get defaultOptions() {
    // V2 still uses the same option schema; we just import mergeObject
    return mergeObject(super.defaultOptions, {
      id: "npc-chat-ui",
      title: `Talk to ${NPC_NAME}`,
      template: "modules/soul-sanctum-logger/templates/npc-chat.html",
      width: 420,
      height: "auto",
      resizable: true,
      popOut: true,
      classes: ["npc-chat"]
      // Position persistence (via localStorage) is automatic because we set an id.
    });
  }

  /** @override – data passed to the Handlebars template */
  async getData(options) {
    // Resolve the NPC actor (by ID if defined, otherwise by name)
    let npc = null;
    if (typeof NPC_ID !== "undefined") {
      npc = game.actors.get(NPC_ID);
    } else {
      npc = game.actors.getName(NPC_NAME);
    }

    // Pull any existing messages that belong to this NPC (optional)
    const stored = game.settings.get("npc-chat-ui", "history") || {};
    const history = stored[npc?.id] || [];

    // Store useful values on the instance for later use (no this.data in V2)
    this.npcName = npc?.name ?? NPC_NAME;
    this.npcId   = npc?.id ?? null;

    // Return the context that the Handlebars template will receive
    return {
      npcName: this.npcName,
      npcId:   this.npcId,
      messages: history   // [{speaker, content, timestamp}, …]
    };
  }

  /** @override – called after the HTML is inserted into the DOM */
  activateListeners(html) {
    super.activateListeners(html);

    // Send button / Enter key
    html.find("#npc-send").click(this._onSend.bind(this));
    html.find("#npc-input").keypress(ev => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        this._onSend(ev);
      }
    });

    // Listen for socket broadcasts from other clients
    game.socket.on("module.npc-chat-ui", this._onSocketMessage.bind(this));
  }

  /* ----------------------------------------------------------------
   *  Private helper – send a new message
   * ---------------------------------------------------------------- */
  async _onSend(event) {
    event.preventDefault();

    const input = this.element.find("#npc-input");
    const raw   = input.val().trim();
    if (!raw) return;

    // Use the values saved in getData()
    const speakerName = this.npcName;   // already cached on the instance
    const npcId       = this.npcId;

    // Build the chat payload – also push it to the global chat log
    const payload = {
      speaker: { alias: speakerName },
      content: `<p>${raw}</p>`,
      flags:   { "npc-chat-ui": { npcId } }
    };

    // 1️⃣ Normal Foundry chat message (visible to everyone)
    await ChatMessage.create(payload, { displaySheet: false });

    // 2️⃣ Store the message locally for this UI (so it persists across opens)
    this._storeLocalMessage({
      speaker: speakerName,
      content: raw,
      ts: Date.now()
    });

    // 3️⃣ Broadcast via socket so all open UI windows update instantly
    game.socket.emit("module.npc-chat-ui", {
      type: "newMessage",
      speaker: speakerName,
      content: raw,
      npcId,
      uiId: this.id
    });

    // Clear the input field
    input.val("");
  }

  /* ----------------------------------------------------------------
   *  Private helper – append a message to the UI’s history view
   * ---------------------------------------------------------------- */
  _appendMessage({ speaker, content }) {
    const chatBox = this.element.find("#npc-history");
    const line = $(
      `<div class="message"><strong>${speaker}:</strong> ${content}</div>`
    );
    chatBox.append(line);
    chatBox.scrollTop(chatBox.prop("scrollHeight"));
  }

  /* ----------------------------------------------------------------
   *  Socket handler – receives broadcasts from other clients
   * ---------------------------------------------------------------- */
  _onSocketMessage(data) {
    if (data.type !== "newMessage") return;
    // Ignore messages that belong to a different NPC
    if (data.npcId && data.npcId !== this.npcId) return;

    // Append to the UI
    this._appendMessage({ speaker: data.speaker, content: data.content });

    // Also store locally (keeps history consistent)
    this._storeLocalMessage({
      speaker: data.speaker,
      content: data.content,
      ts: Date.now()
    });
  }

  /* ----------------------------------------------------------------
   *  Local persistence – keep a short history in module settings
   * ---------------------------------------------------------------- */
  _storeLocalMessage(entry) {
    const settingsKey = "history";
    const allHistory = game.settings.get("npc-chat-ui", settingsKey) || {};

    const npcKey = this.npcId ?? "unknown-npc";
    const npcHist = allHistory[npcKey] ?? [];

    // Keep only the most recent 100 messages (adjust as desired)
    npcHist.push(entry);
    if (npcHist.length > 100) npcHist.shift();

    allHistory[npcKey] = npcHist;
    game.settings.set("npc-chat-ui", settingsKey, allHistory);
  }
}

/* ------------------------------------------------------------------
 *  MODULE INITIALISATION & HOOKS
 * ------------------------------------------------------------------ */

/**
 * Register a module‑scoped socket namespace and a setting to store history.
 */
Hooks.once("init", () => {
  // Register the socket namespace – the empty handler is replaced per UI instance
  game.socket.on("module.npc-chat-ui", () => {});

  // Setting to persist chat history (client‑side; not synced to server)
  game.settings.register("npc-chat-ui", "history", {
    name: "NPC Chat History",
    hint: "Stores recent messages per NPC for the session.",
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
});

/**
 * After the core UI is ready, add a permanent button to the right sidebar.
 */
Hooks.once("ready", () => {
  // ----- Toolbar button (always visible) -----
  const btn = $("<button>")
    .addClass("control-tool")
    .attr("title", "Open NPC Chat")
    .html("<i class='fas fa-comments'></i>")
    .on("click", () => new NpcChatUI().render(true));

  // Insert it at the top of the right UI column
  $("#ui-right").prepend(btn);

  // ----- Optional “💬 Talk” link inside the normal chat log -----
  Hooks.on("renderChatLog", (app, html) => {
    html.find(".message").each((i, el) => {
      const msg = game.messages.contents[i];
      if (msg?.speaker?.alias === NPC_NAME) {
        const talkLink = $('<a class="npc-talk" style="margin-left:0.5em;">💬 Talk</a>');
        talkLink.click(() => new NpcChatUI().render(true));
        $(el).append(talkLink);
      }
    });
  });

  // ----- Expose the UI class globally so macros can call it -----
  window.NpcChatUI = NpcChatUI;
});
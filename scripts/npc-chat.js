/* ------------------------------------------------------------------
 *  IMPORT V2 core classes / utilities
 * ------------------------------------------------------------------ */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { mergeObject } = foundry.utils;

/* ------------------------------------------------------------------
 *  UI CLASS – V2 Application + Handlebars mix‑in
 * ------------------------------------------------------------------ */
class NpcChatUI extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @override – define window options */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "npc-chat-ui",
      title: `Talk to ${NPC_NAME}`,
      template: "modules/soul-sanctum-logger/templates/npc-chat.html",
      width: 420,
      height: "auto",
      resizable: true,
      popOut: true,
      classes: ["npc-chat"]   // scopes any custom CSS you add later
    });
  }

  /** @override – data passed to the Handlebars template */
  async getData(options) {
    // Resolve the NPC actor (by ID if defined, otherwise by name)
    let npc = null;
    if (typeof NPC_ID !== "undefined") npc = game.actors.get(NPC_ID);
    else npc = game.actors.getName(NPC_NAME);

    const stored = game.settings.get("npc-chat-ui", "history") || {};
    const history = stored[npc?.id] || [];

    // Cache for later use (no this.data in V2)
    this.npcName = npc?.name ?? NPC_NAME;
    this.npcId   = npc?.id ?? null;

    return {
      npcName: this.npcName,
      npcId:   this.npcId,
      messages: history
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

    // Socket listener for other clients
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

    const speakerName = this.npcName;
    const npcId       = this.npcId;

    const payload = {
      speaker: { alias: speakerName },
      content: `<p>${raw}</p>`,
      flags:   { "npc-chat-ui": { npcId } }
    };

    // 1️⃣ Normal chat message (visible to everyone)
    await ChatMessage.create(payload, { displaySheet: false });

    // 2️⃣ Store locally for this UI
    this._storeLocalMessage({ speaker: speakerName, content: raw, ts: Date.now() });

    // 3️⃣ Broadcast to other open UI windows
    game.socket.emit("module.npc-chat-ui", {
      type: "newMessage",
      speaker: speakerName,
      content: raw,
      npcId,
      uiId: this.id
    });

    input.val("");
  }

  /* ----------------------------------------------------------------
   *  Private helper – append a message to the UI’s history view
   * ---------------------------------------------------------------- */
  _appendMessage({ speaker, content }) {
    const chatBox = this.element.find("#npc-history");
    const line = $(`<div class="message"><strong>${speaker}:</strong> ${content}</div>`);
    chatBox.append(line);
    chatBox.scrollTop(chatBox.prop("scrollHeight"));
  }

  /* ----------------------------------------------------------------
   *  Socket handler – receives broadcasts from other clients
   * ---------------------------------------------------------------- */
  _onSocketMessage(data) {
    if (data.type !== "newMessage") return;
    if (data.npcId && data.npcId !== this.npcId) return;

    this._appendMessage({ speaker: data.speaker, content: data.content });
    this._storeLocalMessage({ speaker: data.speaker, content: data.content, ts: Date.now() });
  }

  /* ----------------------------------------------------------------
   *  Local persistence – keep a short history in module settings
   * ---------------------------------------------------------------- */
  _storeLocalMessage(entry) {
    const settingsKey = "history";
    const allHistory = game.settings.get("npc-chat-ui", settingsKey) || {};

    const npcKey = this.npcId ?? "unknown-npc";
    const npcHist = allHistory[npcKey] ?? [];

    npcHist.push(entry);
    if (npcHist.length > 100) npcHist.shift();

    allHistory[npcKey] = npcHist;
    game.settings.set("npc-chat-ui", settingsKey, allHistory);
  }
}

/* ------------------------------------------------------------------
 *  MODULE INITIALISATION & HOOKS
 * ------------------------------------------------------------------ */
Hooks.once("init", () => {
  // Register a dummy socket handler (real handlers are added per UI instance)
  game.socket.on("module.npc-chat-ui", () => {});

  // Client‑side setting for chat history
  game.settings.register("npc-chat-ui", "history", {
    name: "NPC Chat History",
    hint: "Stores recent messages per NPC for the session.",
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
});

Hooks.once("ready", () => {
  // Toolbar button
  const btn = $("<button>")
    .addClass("control-tool")
    .attr("title", "Open NPC Chat")
    .html("<i class='fas fa-comments'></i>")
    .on("click", () => new NpcChatUI().render(true));

  $("#ui-right").prepend(btn);

  // Optional “Talk” link in the normal chat log
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

  // Expose globally for macros
  window.NpcChatUI = NpcChatUI;
});
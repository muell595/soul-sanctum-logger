/********************************************************************
 *  npc-chat.js – Foundry VTT module that adds a persistent NPC‑chat UI
 *
 *  What it does
 *  ────────────────
 *  • Defines NpcChatUI – a pop‑out window with its own message log.
 *  • Adds a permanent button to the left UI bar (always visible).
 *  • Sends messages both to the global Foundry chat log and to any
 *    open NpcChatUI windows via a module‑scoped socket.
 *  • Optionally injects a tiny “💬 Talk” link next to NPC messages
 *    in the regular chat log.
 *
 *  How to use
 *  ───────────
 *  1. Enable the module in Foundry → Manage Modules.
 *  2. Click the speech‑bubble button (top‑left) or run a macro:
 *        new NpcChatUI().render(true);
 *  3. Type messages; they appear in the pop‑out and in the normal
 *     chat log, and all players see them instantly.
 *
 *  Customisation
 *  ───────────────
 *  • Change NPC_NAME / NPC_ID to match the actor you want to talk to.
 *  • Adjust width/height in defaultOptions.
 *  • Remove the “renderChatLog” hook if you don’t want the inline link.
 ********************************************************************/

/* ------------------------------------------------------------------
 *  CONFIGURATION – edit these constants to match your NPC
 * ------------------------------------------------------------------ */
const NPC_NAME = "Mysterious Spren";   // Display name shown in the UI
// If you prefer to reference the actor by ID (more reliable):
// const NPC_ID = "Actor.6yLDcl5bqlLquO5R";

/* ------------------------------------------------------------------
 *  UI CLASS – the actual chat window
 * ------------------------------------------------------------------ */
class NpcChatUI extends Application {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "npc-chat-ui",
      title: `Talk to ${NPC_NAME}`,
      template: "modules/npc-chat-ui/templates/npc-chat.html",
      width: 420,
      height: "auto",
      resizable: true,
      popOut: true,
      classes: ["npc-chat"],
      // Remember the last position the user gave the window
      // (Foundry stores this automatically in localStorage)
    });
  }

  /** @override – data passed to the Handlebars template */
  async getData(options) {
    // Resolve the NPC actor (by name or ID)
    let npc = null;
    if (typeof NPC_ID !== "undefined") {
      npc = game.actors.get(NPC_ID);
    } else {
      npc = game.actors.getName(NPC_NAME);
    }

    // Pull any existing messages that belong to this NPC (optional)
    const stored = game.settings.get("npc-chat-ui", "history") || {};
    const history = stored[npc?.id] || [];

    return {
      npcName: npc?.name ?? NPC_NAME,
      npcId: npc?.id ?? null,
      messages: history   // array of {speaker, content, timestamp}
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

  /** ----------------------------------------------------------------
   *  Private helper – send a new message
   * ---------------------------------------------------------------- */
  async _onSend(event) {
    event.preventDefault();

    const input = this.element.find("#npc-input");
    const raw   = input.val().trim();
    if (!raw) return;

    // Build the chat payload – we also push it to the global chat log
    const payload = {
      speaker: { alias: this.data.npcName },
      content: `<p>${raw}</p>`,
      flags:   { "npc-chat-ui": { npcId: this.data.npcId } }
    };

    // Create a normal Foundry chat message (visible to everyone)
    await ChatMessage.create(payload, { displaySheet: false });

    // Store the message locally for this UI (so it persists across opens)
    this._storeLocalMessage({
      speaker: payload.speaker.alias,
      content: raw,
      ts: Date.now()
    });

    // Broadcast via socket so all open UI windows update instantly
    game.socket.emit("module.npc-chat-ui", {
      type: "newMessage",
      speaker: payload.speaker.alias,
      content: raw,
      npcId: this.data.npcId,
      uiId: this.id
    });

    // Clear the input field
    input.val("");
  }

  /** ----------------------------------------------------------------
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

  /** ----------------------------------------------------------------
   *  Socket handler – receives broadcasts from other clients
   * ---------------------------------------------------------------- */
  _onSocketMessage(data) {
    if (data.type !== "newMessage") return;
    // Ignore messages that belong to a different NPC
    if (data.npcId && data.npcId !== this.data.npcId) return;

    // Append to the UI
    this._appendMessage({ speaker: data.speaker, content: data.content });

    // Also store locally (keeps history consistent)
    this._storeLocalMessage({
      speaker: data.speaker,
      content: data.content,
      ts: Date.now()
    });
  }

  /** ----------------------------------------------------------------
   *  Local persistence – keep a short history in module settings
   * ---------------------------------------------------------------- */
  _storeLocalMessage(entry) {
    const settingsKey = "history";
    const allHistory = game.settings.get("npc-chat-ui", settingsKey) || {};

    const npcKey = this.data.npcId ?? "unknown-npc";
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
 * After the core UI is ready, add a permanent button to the left sidebar.
 */
Hooks.once("ready", () => {
  // -----------------------------------------------------------------
  // Add the toolbar button (always visible)
  // -----------------------------------------------------------------
  const btn = $("<button>")
    .addClass("control-tool")
    .attr("title", "Open NPC Chat")
    .html("<i class='fas fa-comments'></i>")
    .on("click", () => new NpcChatUI().render(true));

  // Insert it at the top of the left UI column
  $("#ui-left").prepend(btn);

  // -----------------------------------------------------------------
  // OPTIONAL: inject a tiny “💬 Talk” link into the normal chat log
  // -----------------------------------------------------------------
  Hooks.on("renderChatLog", (app, html) => {
    html.find(".message").each((i, el) => {
      const msg = game.messages.contents[i];
      // Only act on messages that were sent by the NPC we care about
      if (msg?.speaker?.alias === NPC_NAME) {
        const talkLink = $('<a class="npc-talk" style="margin-left:0.5em;">💬 Talk</a>');
        talkLink.click(() => new NpcChatUI().render(true));
        $(el).append(talkLink);
      }
    });
  });

  // -----------------------------------------------------------------
  // 3️⃣ Expose the UI class globally so macros can call it
  // -----------------------------------------------------------------
  window.NpcChatUI = NpcChatUI;
});

/* ------------------------------------------------------------------
 *  END OF FILE
 * ------------------------------------------------------------------ */
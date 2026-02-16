// scripts/npc-chat.js
class NpcChatUI extends Application {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "npc-chat-ui",
      title: "Talk to the NPC",
      template: "modules/npc-chat-ui/templates/npc-chat.html",
      width: 400,
      height: "auto",
      resizable: true,
      popOut: true,
      classes: ["npc-chat"]
    });
  }

  /** Called when the UI is rendered – you can pre‑populate data here */
  async getData(options) {
    // Example: fetch the NPC actor by name or ID
    const npc = game.actors.getName("Mysterious Sage") ?? null;
    return {
      npcName: npc?.name ?? "Unknown NPC",
      messages: []   // will hold chat history for this UI
    };
  }

  /** Activate listeners for the rendered HTML */
  activateListeners(html) {
    super.activateListeners(html);

    // Send button
    html.find("#npc-send").click(this._onSend.bind(this));

    // Listen for incoming messages from other players
    game.socket.on("module.npc-chat-ui", this._onSocketMessage.bind(this));
  }

  /** Handle sending a new line */
  async _onSend(event) {
    event.preventDefault();
    const input = this.element.find("#npc-input");
    const text = input.val().trim();
    if (!text) return;

    // Build a chat message payload
    const payload = {
      speaker: { alias: this.data.npcName },
      content: `<p>${text}</p>`,
      flags: { "npc-chat-ui": { npcId: this.data.npcId } }
    };

    // Create a normal Foundry chat message (so it appears in the main log too)
    await ChatMessage.create(payload, { displaySheet: false });

    // Broadcast via socket so all open UI windows update instantly
    game.socket.emit("module.npc-chat-ui", {
      type: "newMessage",
      content: payload.content,
      speaker: payload.speaker,
      uiId: this.id
    });

    input.val("");
  }

  /** Receive socket updates from other clients */
  _onSocketMessage(data) {
    if (data.type !== "newMessage") return;
    // Append the message to the UI’s local history
    const chatBox = this.element.find("#npc-history");
    chatBox.append(`<div class="message"><strong>${data.speaker.alias}:</strong> ${data.content}</div>`);
    chatBox.scrollTop(chatBox.prop("scrollHeight"));
  }
}

/* ------------------------------------------------------------------ */
/* Hook registration – make the UI reachable from the UI bar or a macro */

Hooks.once("init", () => {
  // Register a socket namespace for our module
  game.socket.on("module.npc-chat-ui", () => {}); // placeholder, real handler added per instance
});

Hooks.once("ready", () => {
  // Add a button to the sidebar (optional)
  const button = $("<button>")
    .addClass("control-tool")
    .attr("title", "Open NPC Chat")
    .html("<i class='fas fa-comments'></i>")
    .on("click", () => new NpcChatUI().render(true));

  $("#ui-left").append(button);
});

Hooks.on("renderChatLog", (app, html) => {
  // Add a small “talk to NPC” button next to each message that mentions the NPC
  html.find(".message").each((i, el) => {
    const msg = game.messages.contents[i];
    if (msg.speaker.alias === "Mysterious Sage") {
      const btn = $('<a class="npc-talk">💬 Talk</a>');
      btn.click(() => new NpcChatUI().render(true));
      $(el).append(btn);
    }
  });
});
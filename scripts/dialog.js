/* -------------------------------------------------------------
 * Simple Dialog – resilient version
 *
 * • Adds a button to the right‑hand toolbar (or creates a tiny
 *   toolbar if none exists).
 * • Clicking the button opens a vanilla Foundry Dialog.
 *
 * Add this file to your module's "scripts" folder and list it in
 * module.json:
 *
 *   "scripts": ["scripts/simple-dialog.js"]
 *
 * ------------------------------------------------------------- */

Hooks.once("ready", () => {
  /**
   * Helper: locate (or create) a vertical toolbar container on the
   * right side of the screen.
   */
  function getOrMakeRightToolbar() {
    // 1️⃣ Try the normal toolbar that ships with Foundry
    let $toolbar = $("#ui-right.sidebar");

    // 2️⃣ If the user has collapsed the right sidebar, the toolbar
    //    element is removed from the DOM.  In that case we create a
    //    lightweight container that mimics the original styling.
    if (!$toolbar.length) {
      console.info(
        "Right-hand toolbar not found - creating a temporary container."
      );

      // Ensure the #ui-right column exists (it always does in stock UI)
      const $rightColumn = $("#ui-right");
      if (!$rightColumn.length) {
        // Very unlikely, but guard against a completely custom UI
        console.warn(
          "Cannot locate #ui-right at all - aborting button insertion."
        );
        return null;
      }

      // Create a div that looks like the built‑in toolbar
      $toolbar = $(
        '<div class="control-tools" style="display:flex;flex-direction:column;margin-top:4px;"></div>'
      );
      // Insert it at the top of the right column
      $rightColumn.prepend($toolbar);
    }

    return $toolbar;
  }

  /** ---------------------------------------------------------
   * 1️⃣ Build the button (styled like the other icons)
   * ------------------------------------------------------- */
  const $btn = $("<button>")
    .addClass("control-tool")
    .attr("title", "Open Simple Dialog")
    .html('<i class="fas fa-comment-dots"></i>') // you can swap the icon
    .css({
      "margin-bottom": "0.5rem",
      "font-size": "1.2rem"
    })
    .on("click", () => {
      /** -------------------------------------------------------
       * 2️⃣ Show the dialog when the button is pressed
       * ----------------------------------------------------- */
      new Dialog({
        title: "Simple Dialog",
        content: `
          <p>This is a basic dialog created by the Simple Dialog module.</p>
          <p>You can replace this HTML with whatever you need: forms,
          information, extra buttons, etc.</p>
        `,
        buttons: {
          ok: {
            label: "OK",
            icon: "<i class='fas fa-check'></i>",
            callback: () => console.log("Simple dialog closed")
          }
        },
        default: "ok",
        close: () => console.log("Dialog closed")
      }).render(true);
    });

  /** ---------------------------------------------------------
   * 3️⃣ Insert the button into the toolbar (or the fallback)
   * ------------------------------------------------------- */
  const $rightToolbar = getOrMakeRightToolbar();
  if ($rightToolbar) {
    // Prepend so the button appears at the top of the column
    $rightToolbar.prepend($btn);
  }
});

/* -------------------------------------------------------------
 * Optional extra safety net – if a module later re‑renders the
 * right sidebar after our button was added, we re‑attach it.
 * ------------------------------------------------------------- */
Hooks.on("renderSidebarTab", (app, html) => {
  // The right sidebar’s main container has the id “sidebar”.
  // When it re‑renders we make sure our button is still present.
  if (app.options.id === "sidebar") {
    const $toolbar = $("#ui-right .control-tools");
    if ($toolbar && !$toolbar.find("#simple-dialog-btn").length) {
      // Re‑insert the button (the same code as above, but without
      // recreating the whole button from scratch).
      $toolbar.prepend($("#simple-dialog-btn"));
    }
  }
});
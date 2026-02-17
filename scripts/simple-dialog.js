/*  --------------------------------------------------------------
 *  Minimal V2 dialog – no mergeObject, no extra dependencies
 *  -------------------------------------------------------------- */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class SimpleDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override – static options for the window */
  static get defaultOptions() {
    // We create the options object from scratch – no mergeObject needed.
    return {
      // Every V2 Application needs an id – this is used for persistence.
      id: "simple-dialog",

      // Title shown in the window’s header bar.
      title: "Simple Dialog",

      // Handlebars template that will be rendered inside the window.
      // (You can also embed raw HTML here – see the “inline template” trick below.)
      template: "modules/your-module/templates/simple-dialog.html",

      // Size – you can use a number (pixels) or "auto".
      width: 300,
      height: "auto",

      // Optional UI tweaks
      resizable: false,
      popOut: true,
      classes: ["simple-dialog"]   // lets you scope CSS later
    };
  }

  /** @override – data that the template receives */
  async getData(options) {
    // For a truly generic dialog we can just return an empty object.
    // Add whatever you want to expose to the template here.
    return {};
  }

  /** @override – hook up any listeners after the HTML is in the DOM */
  activateListeners(html) {
    super.activateListeners(html);

    // Example: close the window when the user clicks a button with id="close"
    html.find("#close").click(() => this.close());
  }
}

/* --------------------------------------------------------------
 *  Export the class so other scripts (macros, other modules) can use it
 * -------------------------------------------------------------- */
export default SimpleDialog;

/* --------------------------------------------------------------
 *  OPTIONAL: expose globally for quick macro testing
 * -------------------------------------------------------------- */
Hooks.once("ready", () => {
  window.SimpleDialog = SimpleDialog;
});
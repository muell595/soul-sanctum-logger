const npcChatContent = await renderTemplate("templates/npc-chat.html", data);

function myCallback() {
    ui.notification.info("Button 1`Clicked!");
}
const myContent = `
    Value:
  <input id="myInputID" type="number" value="0" />
`;

const myDialogOptions = {
  width: 200,
  height: 400,
  top: 500,
  left: 500
};

new Dialog({
  title: "My Custom Dialog Title",
  content: myContent,
    buttons: {
        button1: {
            label: "Display Value",
            callback: (html) => myCallback(html),
            icon: `<i class="fas fa-times"></i>`
      }
    },
    default: "button1"
}, myDialogOptions).render(true);

function myCallback(html) {
    const value = html.find("input#myInputID").val();
  ui.notifications.info(`Value: ${value}`);
}

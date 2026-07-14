const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("watchParty", {
    version: "2.1",
    setChatFocused(focused) {
        ipcRenderer.send("watch-party-chat-focus", Boolean(focused));
    },
    clearChatFocus() {
        ipcRenderer.send("watch-party-chat-focus-clear");
    },
    onChatKey(callback) {
        if (typeof callback !== "function") return () => {};

        const listener = (_event, input) => callback(input);
        ipcRenderer.on("watch-party-chat-key", listener);

        return () => {
            ipcRenderer.removeListener("watch-party-chat-key", listener);
        };
    }
});
const {contextBridge}=require("electron");

contextBridge.exposeInMainWorld("watchParty",{
 app:"Watch Party"
});
const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('load'),
  save: (d) => ipcRenderer.send('save', d),
  icon: (p) => ipcRenderer.invoke('icon', p),
  open: (t, v) => ipcRenderer.send('open', t, v),
  ignore: (on) => ipcRenderer.send('ignore', on),
  pick: () => ipcRenderer.invoke('pick'),
  pathOf: (f) => webUtils.getPathForFile(f)
});

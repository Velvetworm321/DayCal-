const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Config
  getConfig:     ()            => ipcRenderer.invoke('get-config'),
  setConfig:     (data)        => ipcRenderer.invoke('set-config', data),
  applySettings: (s)           => ipcRenderer.send('apply-settings', s),
  onSettingsChanged: (cb)      => ipcRenderer.on('settings-changed', (_, s) => cb(s)),

  // Window control
  getMod:        (name)        => ipcRenderer.invoke('get-mod', name),
  winMoveBy:     (name, dx, dy)=> ipcRenderer.send('win-move-by', { name, dx, dy }),
  winHide:       (name)        => ipcRenderer.send('win-hide', name),
  winShow:       (name)        => ipcRenderer.send('win-show', name),
  winPin:        (name, pinned)=> ipcRenderer.send('win-pin', { name, pinned }),
  resizeWin:     (name, w, h)  => ipcRenderer.send('resize-win', { name, w, h }),
  openSettings:  ()            => ipcRenderer.send('open-settings'),
  closeSettings: ()            => ipcRenderer.send('close-settings'),

  // Shared data store
  getData:       ()            => ipcRenderer.invoke('data-get'),
  setData:       (data)        => ipcRenderer.invoke('data-set', data),
  onDataChanged: (cb)          => ipcRenderer.on('data-changed', (_, d) => cb(d)),

  // AI API key (stored in config)
  getApiKey:     ()      => ipcRenderer.invoke('get-apikey'),
  setApiKey:     (key)   => ipcRenderer.invoke('set-apikey', key),

  // Alarm audio broadcast — fire/stop sent from any window, main relays to ALL windows
  broadcastAlarmFire: (info)   => ipcRenderer.send('alarm-fire', info),
  broadcastAlarmStop: (id)     => ipcRenderer.send('alarm-stop', id),
  onAlarmFire: (cb)            => ipcRenderer.on('alarm-fire-bcast', (_, info) => cb(info)),
  onAlarmStop: (cb)            => ipcRenderer.on('alarm-stop-bcast', (_, id)  => cb(id)),
});

// Native shells share one storage bridge: Electron exposes it through preload, Android through a JavaScript interface.
function desktopHost(bridge) {
  return {
    kind: 'desktop', name: '桌面版',
    loadState: () => bridge.loadState(),
    saveState: raw => bridge.saveState(raw),
    info: () => bridge.info(),
    ready: details => bridge.ready(details),
    onSettings: callback => bridge.onSettings(callback),
    onCloseRequested: callback => bridge.onCloseRequested(callback)
  };
}

// Android interface methods are synchronous and answer with JSON; an "error" field means the call failed.
function androidHost(android) {
  const call = (method, ...args) => {
    const reply = JSON.parse(android[method](...args));
    if (reply?.error) throw new Error(reply.error);
    return reply;
  };
  return {
    kind: 'android', name: '手机版',
    loadState: async () => call('loadState'),
    saveState: async raw => call('saveState', raw),
    info: async () => call('info'),
    // The save location is chosen in a system picker; the outcome arrives later as a "file" native event.
    saveFile: (name, text) => call('saveFile', name, text),
    openSpeechSettings: () => call('openSpeechSettings'),
    setSystemBars: (statusColor, navigationColor, dark) => { try { android.setSystemBars(statusColor, navigationColor, dark); } catch {} },
    ready() {}, onSettings() {}, onCloseRequested() {}
  };
}

export function nativeHost(scope = globalThis) {
  if (scope.tingduDesktop) return desktopHost(scope.tingduDesktop);
  if (scope.TingduAndroid) return androidHost(scope.TingduAndroid);
  return null;
}

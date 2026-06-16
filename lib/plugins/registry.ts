

const installed = new Set([
  //'voice-call',
  'ai-chat',
  //'meta-cloud',
]);

export function isPluginInstalled(pluginId: string): boolean {
  return installed.has(pluginId);
}

export function getInstalledPlugins(): string[] {
  return [...installed];
}

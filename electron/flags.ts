export const FLAG_PRESETS: Record<string, { label: string; flags: string[] }> = {
  standard: { label: 'Стандарт', flags: [] },
  aikar: {
    label: 'Производительность (Aikar)',
    flags: [
      '-XX:+UseG1GC', '-XX:+ParallelRefProcEnabled', '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions', '-XX:+DisableExplicitGC', '-XX:+AlwaysPreTouch',
      '-XX:G1NewSizePercent=30', '-XX:G1MaxNewSizePercent=40', '-XX:G1HeapRegionSize=8M',
      '-XX:G1ReservePercent=20', '-XX:G1HeapWastePercent=5', '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=15', '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5', '-XX:SurvivorRatio=32',
      '-XX:+PerfDisableSharedMem', '-XX:MaxTenuringThreshold=1',
    ],
  },
  fps: {
    label: 'Максимум FPS',
    flags: ['-XX:+UseG1GC', '-XX:+UnlockExperimentalVMOptions', '-XX:MaxGCPauseMillis=50', '-XX:+AlwaysPreTouch', '-Dfml.earlyWindowControl=false'],
  },
  weak: {
    label: 'Слабый ПК',
    flags: ['-XX:+UseG1GC', '-XX:MaxGCPauseMillis=200', '-XX:G1HeapRegionSize=4M', '-Dfml.earlyWindowControl=false'],
  },
  custom: { label: 'Свои флаги', flags: [] },
}

export function buildCustomArgs(preset: string, customFlags: string): string[] {
  if (preset === 'custom') {
    return customFlags.split(/\s+/).map((s) => s.trim()).filter(Boolean)
  }
  return [...(FLAG_PRESETS[preset]?.flags || [])]
}

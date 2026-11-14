// NSH validates absolute executable paths using the build host's path rules.
// Keep the source manifest portable; add native lookup paths in an isolated
// packaging project so a Windows build never parses Unix path grants.
export function desktopConfig(base, target) {
  const config = structuredClone(base);
  config.capabilities.process.execute = target === 'windows' ? ['yt-dlp.exe', 'yt-dlp']
    : target === 'linux' ? ['yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp']
    : ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp', 'yt-dlp'];
  return config;
}

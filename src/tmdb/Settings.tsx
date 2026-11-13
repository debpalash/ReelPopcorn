import { cleanup, Image, openUrl, Scroll, signal, Text, View } from "nsh";
import { Button, Input, Notice } from "../ui";
import tmdbLogo from "../../assets/tmdb.svg";
import { TmdbClient } from "./api";
import { tmdbConnection, useConnection } from "./state";
import { discoveryOptions, loadScenes, scenesReady, useDiscoveryOptions } from "../scenes/state";
import { INSTANCES, type Provider } from "../scenes/discovery";

export function Settings(props: { onDone: () => void }) {
  void loadScenes();
  const token = signal("");
  const busy = signal(false);
  const error = signal("");
  let abort: AbortController | undefined;
  let live = true;
  cleanup(() => { live = false; abort?.abort(); });
  const connect = async () => {
    if (busy() || !token().trim()) return;
    const connection = { mode: "direct" as const, token: token().trim() };
    abort = new AbortController();
    busy.set(true); error.set("");
    try {
      await new TmdbClient(connection).get("configuration", {}, abort.signal);
      if (!abort.signal.aborted) { useConnection(connection); token.set(""); props.onDone(); }
    } catch (e) { if (!abort.signal.aborted) error.set(e instanceof Error ? e.message : "Couldn’t connect."); }
    finally { if (live) busy.set(false); }
  };
  return <Scroll class="flex-1"><View class="gap-6 p-8" style={{ maxWidth: 700 }}>
    <Text class="text-xl font-semibold text-foreground">Connection</Text>
    <View class="gap-3">
      <Text class="text-base font-semibold text-foreground">Clip discovery</Text>
      <View class="flex-row gap-2">
        <Each of={["auto", "yt-dlp", "invidious"] as Provider[]}>{(provider)=><Button label={provider()==="auto"?"Auto":provider()==="invidious"?"Invidious":"yt-dlp"}
          selected={discoveryOptions().provider===provider()} disabled={!scenesReady()} onPress={()=>useDiscoveryOptions({...discoveryOptions(),provider:provider()})}/>}</Each>
      </View>
      <Notice>Auto uses local yt-dlp, then Invidious.</Notice>
      <If when={discoveryOptions().provider!=="yt-dlp"}>
        <Each of={INSTANCES}>{(instance)=><Button label={new URL(instance()).hostname} selected={discoveryOptions().instance===instance()}
          variant="ghost" disabled={!scenesReady()} onPress={()=>useDiscoveryOptions({...discoveryOptions(),instance:instance()})}/>}</Each>
      </If>
      <Button label="Done" onPress={props.onDone}/>
    </View>
    <Text class="text-base text-muted-foreground">{tmdbConnection().mode === "guest" ? "Guest · Nuxt Movies public proxy" : "TMDB · Direct"}</Text>
    <View class="gap-3">
      <Text class="text-base text-foreground">TMDB API read token or API key</Text>
      <View class="flex-row"><Input testID="tmdb-token" value={token()} onChange={(value) => token.set(value)} onSubmit={() => { void connect(); }}
        label="TMDB token" placeholder="Token" masked /></View>
      <Notice>Used for this session.</Notice>
      <If when={error()}><Notice error>{error()}</Notice></If>
      <View class="flex-row gap-2">
        <Button label={busy() ? "Connecting…" : "Connect"} variant="primary" disabled={busy() || !token().trim()} onPress={() => { void connect(); }} />
        <Button label="Use guest" onPress={() => { abort?.abort(); useConnection({ mode: "guest", token: "" }); props.onDone(); }} />
        <Button label="API settings" variant="ghost" onPress={() => { void openUrl("https://www.themoviedb.org/settings/api").catch(() => error.set("Couldn’t open your browser.")); }} />
      </View>
    </View>
    <View class="gap-3">
      <Text class="text-base font-semibold text-foreground">Credits</Text>
      <Image src={tmdbLogo} accessibilityLabel="TMDB" style={{ width: 76, height: 33 }} />
      <Text class="text-sm text-muted-foreground">This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
      <Button label="TMDB" variant="ghost" onPress={() => { void openUrl("https://www.themoviedb.org").catch(() => error.set("Couldn’t open your browser.")); }} />
    </View>
  </View></Scroll>;
}

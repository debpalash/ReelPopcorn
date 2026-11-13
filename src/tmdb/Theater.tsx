import { computed, keymap, List, openUrl, resource, Scroll, signal, Text, View } from "nsh";
import { Player } from "../Player";
import { Button, Empty, Input, Notice, WindowBar, animateLayout } from "../ui";
import { TmdbClient } from "./api";
import { formatTime, parseTime, positionOf, sortClips, titleKey, year, type Clip, type ClipOrder, type Media, type TitleDetail, type TitleRef } from "./model";
import { inWatchlist, localError, localReady, setPosition, timelinePositions, tmdbConnection, toggleWatchlist } from "./state";
import { ClipRow, StoryRuler } from "./ui";

export function Theater(props: { title: Media; onBack: () => void }) {
  const scope = signal<TitleRef>({ kind: props.title.kind, id: props.title.id });
  const selectedId = signal("");
  const order = signal<ClipOrder>("published");
  const filter = signal<"all" | "clips">("all");
  const positionDraft = signal("");
  const editing = signal(false);
  const notice = signal("");
  const detail = resource(() => ({ ref: scope(), connection: tmdbConnection() }), async (source, { signal: abort }) => new TmdbClient(source.connection).detail(source.ref, abort));
  const currentDetail = () => detail() && titleKey(detail()!) === titleKey(scope()) ? detail() : undefined;
  const clips = computed(() => sortClips((currentDetail()?.clips ?? []).filter((clip) => filter() === "all" || clip.type === "Clip"), order(), timelinePositions()));
  const active = () => clips().find((clip) => clip.youtubeId === selectedId()) ?? clips()[0];
  const activeIndex = () => clips().findIndex((clip) => clip.youtubeId === active()?.youtubeId);
  const video = computed(() => { const clip = active(); return clip ? { id: clip.youtubeId, title: clip.name, author: props.title.title } : null; });
  const next = () => { const clip = clips()[activeIndex() + 1]; if (clip) selectClip(clip); };
  const selectClip = (clip: Clip) => { selectedId.set(clip.youtubeId); editing.set(false); notice.set(""); };
  const setScope = (ref: TitleRef) => { selectedId.set(""); editing.set(false); scope.set(ref); };
  const savePosition = () => {
    const clip = active(); if (!clip) return;
    const seconds = parseTime(positionDraft());
    if (seconds === null) { notice.set("Use mm:ss or hh:mm:ss."); return; }
    const runtime = currentDetail()?.runtime;
    if (runtime && seconds > runtime * 60) { notice.set("Position exceeds the runtime."); return; }
    animateLayout(() => { selectedId.set(clip.youtubeId); setPosition(clip.source, clip.youtubeId, seconds); editing.set(false); });
  };
  const openExternal = (url: string) => { void openUrl(url).then((r) => { if (!r.opened) notice.set("Couldn’t open your browser."); }).catch(() => notice.set("Couldn’t open your browser.")); };
  keymap.bind("Escape", () => { if (editing()) editing.set(false); else props.onBack(); });
  keymap.bind("alt+right", next);

  return <View class="flex-1 gap-4">
    <WindowBar>
      <Button label="Back" variant="ghost" onPress={props.onBack} />
      <View class="flex-1 gap-1">
        <Text class="text-xl font-semibold text-foreground">{props.title.title}</Text>
        <Text class="text-sm text-muted-foreground">{year(props.title.date)}{props.title.kind === "tv" ? " · TV" : currentDetail()?.runtime ? ` · ${currentDetail()?.runtime} min` : ""}{scope().season !== undefined ? ` · Season ${scope().season}` : ""}{scope().episode !== undefined ? ` · Episode ${scope().episode}` : ""}</Text>
      </View>
      <Button label={inWatchlist(props.title) ? "In watchlist" : "Watchlist"} selected={inWatchlist(props.title)}
        disabled={!localReady()} onPress={() => toggleWatchlist(props.title)} />
      <Button label="TMDB" variant="ghost" onPress={() => openExternal(`https://www.themoviedb.org/${props.title.kind}/${props.title.id}`)} />
      <If when={currentDetail()?.imdbId}><Button label="IMDb" variant="ghost" onPress={() => openExternal(`https://www.imdb.com/title/${currentDetail()?.imdbId}/`)} /></If>
    </WindowBar>
    <If when={notice()}><Notice error>{notice()}</Notice></If>
    <If when={localError()}><Notice error>{localError()}</Notice></If>
    <If when={detail.loading() && !currentDetail()}><Notice>Loading…</Notice></If>
    <If when={detail.error()}>
      <View class="flex-row items-center gap-3"><Notice error>{String(detail.error() instanceof Error ? (detail.error() as Error).message : detail.error())}</Notice><Button label="Retry" onPress={detail.refetch} /></View>
    </If>
    <If when={currentDetail()}>{(loaded) => <View class="flex-1 flex-row gap-6">
      <Scroll class="flex-1" testID="theater-content">
        <View class="gap-4">
          <If when={video()} else={<Empty title="No videos" detail="No YouTube videos are linked to this title." />}>
            <Player theater video={video()} hasNext={activeIndex() < clips().length - 1} onNext={next} onEnded={next} />
          </If>
          <StoryRuler clips={clips()} positions={timelinePositions()} runtime={loaded().runtime ?? 0} selectedId={active()?.youtubeId} onSelect={selectClip} />
          <If when={active()}>{(clip) => <View class="gap-3">
            <Text class="text-base font-semibold text-foreground">{clip().name}</Text>
            <View class="flex-row items-center gap-2 flex-wrap">
              <Text class="text-sm text-muted-foreground">{clip().type}{clip().official ? " · Official" : ""}{clip().publishedAt ? ` · ${clip().publishedAt.slice(0, 10)}` : ""}</Text>
              <Button label={positionOf(clip(), timelinePositions()) ? formatTime(positionOf(clip(), timelinePositions())!.seconds) : "Set position…"} variant="ghost" disabled={!localReady()}
                accessibilityLabel="Set story position" onPress={() => { positionDraft.set(positionOf(clip(), timelinePositions()) ? formatTime(positionOf(clip(), timelinePositions())!.seconds) : ""); editing.set(!editing()); notice.set(""); }} />
            </View>
            <If when={editing()}>
              <View class="flex-row gap-2 items-center">
                <Input testID="story-position" label="Story position" placeholder="hh:mm:ss" value={positionDraft()} onChange={(value) => positionDraft.set(value)} onSubmit={savePosition} />
                <Button label="Save position" onPress={savePosition} />
                <Button label="Clear" variant="ghost" onPress={() => { setPosition(clip().source, clip().youtubeId, null); editing.set(false); }} />
              </View>
            </If>
          </View>}</If>
          <Text class="text-sm text-muted-foreground" style={{ numberOfLines: 4 }}>{props.title.overview || loaded().overview}</Text>
          <If when={props.title.kind === "tv"}>
            <ScopePicker root={props.title} detail={loaded()} scope={scope()} onSelect={setScope} />
          </If>
        </View>
      </Scroll>
      <View class="gap-3" style={{ width: 352 }}>
        <View class="flex-row items-center justify-between">
          <Text class="text-base font-semibold text-foreground">Videos</Text>
          <Text class="text-sm text-muted-foreground">{clips().length}</Text>
        </View>
        <View class="flex-row gap-2">
          <Button label="Published" selected={order() === "published"} variant="ghost" onPress={() => { selectedId.set(active()?.youtubeId ?? ""); order.set("published"); }} />
          <Button label="Story order" selected={order() === "story"} variant="ghost" onPress={() => { selectedId.set(active()?.youtubeId ?? ""); order.set("story"); }} />
        </View>
        <View class="flex-row gap-2">
          <Button label="All videos" selected={filter() === "all"} variant="ghost" onPress={() => filter.set("all")} />
          <Button label="Clips" selected={filter() === "clips"} variant="ghost" onPress={() => filter.set("clips")} />
        </View>
        <If when={order() === "story" && clips().some((clip) => !positionOf(clip, timelinePositions()))}><Notice>Unplaced videos follow positioned clips.</Notice></If>
        <If when={clips().length === 0 && filter() === "clips"}><Notice>No clips linked to this title.</Notice></If>
        <List each={clips()} keyExtractor={(clip) => clip.youtubeId} estimatedItemSize={88} class="flex-1" testID="clip-timeline">
          {(clip) => <ClipRow clip={clip} selected={active()?.youtubeId === clip().youtubeId} positions={timelinePositions()} story={order() === "story"} onSelect={() => selectClip(clip())} />}
        </List>
      </View>
    </View>}</If>
  </View>;
}

function ScopePicker(props: { root: Media; detail: TitleDetail; scope: TitleRef; onSelect: (ref: TitleRef) => void }) {
  return <View class="gap-3">
    <View class="flex-row gap-2 flex-wrap">
      <Button label="Series" variant="ghost" selected={props.scope.season === undefined} onPress={() => props.onSelect({ kind: "tv", id: props.root.id })} />
      <Each of={props.detail.seasons} key={(season) => season.number}>{(season) => <Button label={season().name} variant="ghost" onPress={() => props.onSelect({ kind: "tv", id: props.root.id, season: season().number })} />}</Each>
      <If when={props.scope.episode !== undefined}><Button label={`Season ${props.scope.season}`} variant="ghost" onPress={() => props.onSelect({ kind: "tv", id: props.root.id, season: props.scope.season })} /></If>
    </View>
    <Each of={props.detail.episodes} key={(episode) => episode.number}>{(episode) => <View class="flex-row gap-2 items-center">
      <Button label={`E${episode().number} · ${episode().name}`} variant="ghost" onPress={() => props.onSelect({ kind: "tv", id: props.root.id, season: props.scope.season, episode: episode().number })} />
      <Text class="text-sm text-muted-foreground">{episode().date}</Text>
    </View>}</Each>
  </View>;
}

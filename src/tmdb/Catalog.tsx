import { computed, keymap, List, resource, signal, Text, View, windowSize, type InputRef } from "nsh";
import { Menu } from "nsh/desktop";
import { Button, Empty, WindowBar, Input, Notice, animateLayout } from "../ui";
import { TmdbClient } from "./api";
import { Settings } from "./Settings";
import { SceneTheater } from "../scenes/SceneTheater";
import { titleKey, type Media, type MediaKind } from "./model";
import { loadTmdbState, localError, tmdbConnection, watchlistTitles } from "./state";
import { Poster } from "./ui";

export function Catalog() {
  const section = signal<"all" | MediaKind | "watchlist">("all");
  const settings = signal(false);
  const selected = signal<Media | null>(null);
  const search = signal("");
  const query = signal("");
  const page = signal(1);
  let input: InputRef | undefined;
  void loadTmdbState();
  const source = () => section() !== "watchlist" && !settings() && !selected() ? { kind: section() as "all" | MediaKind, query: query(), page: page(), connection: tmdbConnection() } : null;
  const listing = resource(source, async (value, { signal: abort }) => new TmdbClient(value.connection).browse(value.kind, value.query, value.page, abort));
  const titles = computed(() => section() === "watchlist" ? watchlistTitles().filter((item) => `${item.title} ${item.originalTitle}`.toLowerCase().includes(query().toLowerCase())) : listing()?.items ?? []);
  const columns = () => Math.max(2, Math.min(6, Math.floor((windowSize().width - 48) / 208)));
  const posterWidth = () => Math.floor((windowSize().width - 48 - (columns() - 1) * 16) / columns());
  const rows = computed(() => { const all = titles(), size = columns(); const result: Media[][] = []; for (let i = 0; i < all.length; i += size) result.push(all.slice(i, i + size)); return result; });
  const chooseSection = (next: "all" | MediaKind | "watchlist") => { section.set(next); selected.set(null); settings.set(false); query.set(""); search.set(""); page.set(1); };
  const submit = () => { selected.set(null); page.set(1); query.set(search().trim()); };
  const openTitle = (title: Media) => animateLayout(() => { selected.set(title); });
  const goBack = () => animateLayout(() => selected.set(null));
  keymap.bind("mod+f", () => input?.focus());
  keymap.bind("mod+1", () => chooseSection("all"));
  keymap.bind("mod+2", () => chooseSection("movie"));
  keymap.bind("mod+3", () => chooseSection("tv"));
  keymap.bind("mod+4", () => chooseSection("watchlist"));
  Menu.setApplicationMenu([
    { label: "ReelPopcorn", submenu: [{ role: "about" }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "showAll" }, { type: "separator" }, { role: "quit" }] },
    { label: "File", submenu: [{ label: "Search", shortcut: "mod+f", onSelect: () => input?.focus() }, { label: "Connection…", shortcut: "mod+,", onSelect: () => settings.set(true) }, { type: "separator" }, { role: "close" }] },
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [
      { label: "Discover", shortcut: "mod+1", onSelect: () => chooseSection("all") },
      { label: "Movies", shortcut: "mod+2", onSelect: () => chooseSection("movie") },
      { label: "TV", shortcut: "mod+3", onSelect: () => chooseSection("tv") },
      { label: "Watchlist", shortcut: "mod+4", onSelect: () => chooseSection("watchlist") },
      { type: "separator" }, { role: "toggleFullScreen" }
    ] },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }] }
  ]);
  return <View class="flex-1 bg-background">
    <If when={!selected() || settings()}><WindowBar>
      <Button label="Discover" selected={section() === "all" && !settings()} variant="ghost" onPress={() => chooseSection("all")} />
      <Button label="Movies" selected={section() === "movie" && !settings()} variant="ghost" onPress={() => chooseSection("movie")} />
      <Button label="TV" selected={section() === "tv" && !settings()} variant="ghost" onPress={() => chooseSection("tv")} />
      <Button label="Watchlist" selected={section() === "watchlist" && !settings()} variant="ghost" onPress={() => chooseSection("watchlist")} />
      <View class="flex-1" />
      <Button label="Connection…" variant="ghost" selected={settings()} onPress={() => { settings.set(!settings()); }} />
    </WindowBar></If>
    <If when={settings()} else={
      <If when={selected()} else={
        <View class="flex-1 gap-3 p-4">
          <View class="flex-row gap-3 items-center">
            <Input inputRef={(ref) => { input = ref; }} testID="catalog-search" value={search()} onChange={(value) => search.set(value)} onSubmit={submit}
              label="Search TMDB" placeholder="Title, IMDb ID, or movie:123" />
            <Button label="Search" onPress={submit} />
          </View>
          <View class="flex-row items-center justify-between">
            <Text class="text-xl font-semibold text-foreground">{query() ? "Search" : section() === "watchlist" ? "Watchlist" : "Trending"}</Text>
            <If when={listing.loading() && section() !== "watchlist"}><Notice>Loading…</Notice></If>
          </View>
          <If when={listing.error() && section() !== "watchlist"}>
            <View class="flex-row items-center gap-3"><Notice error>{listing.error() instanceof Error ? (listing.error() as Error).message : String(listing.error())}</Notice><Button label="Retry" onPress={listing.refetch} /></View>
          </If>
          <If when={localError()}><Notice error>{localError()}</Notice></If>
          <If when={titles().length > 0} else={
            <If when={!listing.loading() || section() === "watchlist"}><Empty title={section() === "watchlist" ? "No saved titles" : "No results"}
              detail={section() === "watchlist" ? "Add a title to your watchlist." : listing.error() ? "Retry or change the connection." : "Try another title or ID."} /></If>
          }>
            <List each={rows()} keyExtractor={(row) => row.map(titleKey).join("|")} estimatedItemSize={posterWidth() * 1.5 + 72} class="flex-1" testID="tmdb-catalog">
              {(row) => <View class="flex-row gap-4 pb-6">
                <Each of={row()} key={titleKey}>{(item) => <Poster media={item} width={posterWidth()} onOpen={openTitle} />}</Each>
              </View>}
            </List>
          </If>
          <View class="flex-row items-center gap-3">
            <Text class="text-xs text-muted-foreground">TMDB</Text>
            <View class="flex-1" />
            <If when={section() !== "watchlist" && (listing()?.totalPages ?? 0) > 1}>
              <Button label="Previous" variant="ghost" disabled={page() <= 1 || listing.loading()} onPress={() => page.update((value) => value - 1)} />
              <Text class="text-sm text-muted-foreground">{listing()?.page ?? page()}</Text>
              <Button label="Next page" variant="ghost" disabled={page() >= (listing()?.totalPages ?? 1) || listing.loading()} onPress={() => page.update((value) => value + 1)} />
            </If>
          </View>
        </View>
      }>{(title) => <SceneTheater title={title()} onBack={goBack} onConnection={()=>settings.set(true)} />}</If>
    }><View class="flex-1 p-4"><Settings onDone={() => settings.set(false)} /></View></If>
  </View>;
}

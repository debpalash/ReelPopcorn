import { Image, reduceMotion, signal, Text, View, type Accessor } from "nsh";
import { Button as BaseButton } from "nsh/base";
import { imageUrl, positionOf, year, formatTime, type Clip, type Media, type Positions } from "./model";
import { motion } from "../ui";

export function Poster(props: { media: Accessor<Media>; width: number; onOpen: (media: Media) => void }) {
  return <BaseButton accessibilityLabel={`Open ${props.media().title}`} onPress={() => props.onOpen(props.media())}
    class="gap-2 items-start rounded-xl hover:bg-muted active:bg-accent focus-visible:ring-2 focus-visible:ring-ring p-1"
    style={{ width: props.width, transitionProperty: "background-color", transitionDuration: reduceMotion() ? 0 : motion.instant }}>
    <View class="w-full rounded-xl overflow-hidden bg-muted" style={{ height: Math.round((props.width - 8) * 1.5) }}>
      <If when={imageUrl(props.media().poster)} else={<View class="flex-1 items-center justify-center px-4"><Text class="text-sm text-muted-foreground">{props.media().title}</Text></View>}>
        <Image src={imageUrl(props.media().poster)} accessibilityLabel={props.media().title} class="flex-1 w-full object-cover" />
      </If>
    </View>
    <Text class="text-base font-semibold text-foreground" style={{ numberOfLines: 1 }}>{props.media().title}</Text>
    <Text class="text-sm text-muted-foreground">{year(props.media().date)}{props.media().date ? " · " : ""}{props.media().kind === "movie" ? "Movie" : "TV"}</Text>
  </BaseButton>;
}

export function ClipRow(props: { clip: Accessor<Clip>; selected: boolean; positions: Positions; story: boolean; onSelect: () => void }) {
  return <BaseButton accessibilityLabel={`Play ${props.clip().name}`} selected={props.selected} onPress={props.onSelect}
    class={`flex-row items-center gap-3 rounded-xl p-3 hover:bg-muted active:bg-accent focus-visible:ring-2 focus-visible:ring-ring ${props.selected ? "bg-accent" : ""}`}
    style={{ transitionProperty: "background-color", transitionDuration: reduceMotion() ? 0 : motion.instant }}>
    <Image src={`https://i.ytimg.com/vi/${props.clip().youtubeId}/mqdefault.jpg`} accessibilityLabel={props.clip().name}
      class="w-24 h-14 object-cover rounded-lg bg-muted" />
    <View class="flex-1 gap-1">
      <Text class="text-sm font-semibold text-foreground" style={{ numberOfLines: 2 }}>{props.clip().name}</Text>
      <Text class="text-sm text-muted-foreground">{props.story ? positionOf(props.clip(), props.positions) ? formatTime(positionOf(props.clip(), props.positions)!.seconds) : "Unplaced" : props.clip().publishedAt.slice(0, 10) || "Undated"}{" · "}{props.clip().type}</Text>
    </View>
  </BaseButton>;
}

export function StoryRuler(props: { clips: Clip[]; positions: Positions; runtime: number; selectedId?: string; onSelect: (clip: Clip) => void }) {
  const width = signal(600);
  const placed = () => props.clips.filter((clip) => positionOf(clip, props.positions));
  return <If when={placed().length > 0 && props.runtime > 0}>
    <View class="gap-1" testID="story-ruler" onLayout={(e) => width.set(e.bounds.size.width)}>
      <View class="flex-row justify-between">
        <Text class="text-sm text-muted-foreground">Story</Text>
        <Text class="text-sm text-muted-foreground">{formatTime(props.runtime * 60)}</Text>
      </View>
      <View class="h-8 justify-center">
        <View class="h-1 rounded-full bg-muted" />
        <Each of={placed()} key={(clip) => clip.youtubeId}>{(clip) => <BaseButton
          accessibilityLabel={`Play ${clip().name} at ${formatTime(positionOf(clip(), props.positions)?.seconds ?? 0)}`}
          onPress={() => props.onSelect(clip())}
          class="absolute top-0 h-8 w-8 items-center justify-center focus-visible:ring-2 focus-visible:ring-ring rounded-full hover:bg-accent active:bg-accent"
          style={{ left: Math.max(0, Math.min(width() - 32, ((positionOf(clip(), props.positions)?.seconds ?? 0) / (props.runtime * 60)) * (width() - 32))) }}>
          <View class={`h-3 w-3 rounded-full ${props.selectedId === clip().youtubeId ? "bg-primary" : "bg-muted-foreground"}`} />
        </BaseButton>}</Each>
      </View>
    </View>
  </If>;
}

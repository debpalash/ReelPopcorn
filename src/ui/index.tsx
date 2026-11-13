import { Image, LayoutAnimation, reduceMotion, token, Text, View, type ImageAsset, type InputRef, type JSX } from "nsh";
import { titleBar } from "nsh/desktop";
import { Button as BaseButton, Input as BaseInput } from "nsh/base";

export const motion = { instant: 120, base: 200 };

export function animateLayout(change: () => void) {
  if (!reduceMotion()) LayoutAnimation.configureNext({ duration: motion.base, update: { type: "easeInEaseOut" } });
  change();
}

export function Button(props: {
  label: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost";
  selected?: boolean; disabled?: boolean; testID?: string; accessibilityLabel?: string; icon?:ImageAsset;
}) {
  return <BaseButton onPress={props.onPress} disabled={props.disabled} selected={props.selected}
    testID={props.testID} accessibilityLabel={props.accessibilityLabel ?? props.label} tooltip={props.accessibilityLabel ?? props.label}
    class={`min-h-6 justify-center items-center rounded-md px-2.5 hover:bg-accent active:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 ${props.selected ? "bg-accent" : props.variant === "primary" ? "bg-primary hover:bg-primary/90 active:bg-primary/80" : props.variant === "ghost" ? "" : "bg-secondary"}`}
    style={{ transitionProperty: "background-color", transitionDuration: reduceMotion() ? 0 : motion.instant }}>
    <If when={props.icon} else={<Text class={`text-sm font-medium ${props.variant === "primary" ? "text-primary-foreground" : "text-foreground"}`}>{props.label}</Text>}><Image src={props.icon} class="w-4 h-4" style={{tintColor:token("foreground")}}/></If>
  </BaseButton>;
}

export function Input(props: {
  value: string; onChange: (value: string) => void; onSubmit?: () => void;
  placeholder: string; label: string; testID: string; inputRef?: (ref: InputRef) => void; masked?: boolean;
}) {
  return <BaseInput ref={props.inputRef} value={props.value} onChange={(e) => props.onChange(e.value)}
    onSubmit={props.onSubmit} placeholder={props.placeholder} accessibilityLabel={props.label} testID={props.testID}
    autoCapitalize="none" autoCorrect={false} returnKeyType="go" masked={props.masked}
    class="min-h-8 flex-1 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring" />;
}

export function Textarea(props: { value:string; onChange:(value:string)=>void; label:string; testID:string; placeholder?:string }) {
  return <BaseInput value={props.value} onChange={(e)=>props.onChange(e.value)} multiline submitBehavior="newline"
    testID={props.testID} accessibilityLabel={props.label} placeholder={props.placeholder} maxLength={250000}
    autoCapitalize="none" autoCorrect={false}
    class="h-40 rounded-(--radius) border border-input bg-card p-3 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring" />;
}

export function Empty(props: { title: string; detail: string }) {
  return <View class="gap-2 px-6 py-8">
    <Text class="text-xl font-semibold text-foreground">{props.title}</Text>
    <Text class="text-base text-muted-foreground">{props.detail}</Text>
  </View>;
}

export function Notice(props: { children: JSX.Element; error?: boolean }) {
  return <Text role={props.error ? "alert" : "text"} class={`text-sm ${props.error ? "text-destructive" : "text-muted-foreground"}`}>{props.children}</Text>;
}

/** Native traffic lights keep their system-owned hit area. */
export function WindowBar(props: { children: JSX.Element }) {
  return <View desktop={{windowDrag:true}} class="flex-row items-center gap-1 border-b border-border"
    style={{height:Math.max(32,titleBar().height),paddingLeft:Math.max(10,titleBar().left+8),paddingRight:Math.max(8,titleBar().right+8),glassEffect:"regular",backdropFilter:"blur(24px)"}}>
    {props.children}
  </View>;
}

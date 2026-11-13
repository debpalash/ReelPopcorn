import {expect,test} from "nsh/test";
import {isMediaSource,mediaCapabilities,mediaKey,parseMediaSource,sourceStart} from "./source";

test("normalizes provider URLs without confusing identical numeric IDs",()=>{
 const youtube=parseMediaSource("https://youtu.be/aqz-KE-bpKQ?t=1m30s")!;
 expect(mediaKey(youtube)).toBe("aqz-KE-bpKQ");expect(sourceStart(youtube)).toBe(90);
 const vimeo=parseMediaSource("https://player.vimeo.com/video/123456789?h=abc123")!;
 expect(vimeo.url).toBe("https://vimeo.com/123456789?h=abc123");
 expect(mediaKey(vimeo)).toBe("vimeo:123456789");
 expect(mediaKey(parseMediaSource("https://www.twitch.tv/videos/123456789")!)).toBe("twitch:video:123456789");
 expect(parseMediaSource("https://www.tiktok.com/@user/video/7527476667770522893")?.id).toBe("7527476667770522893");
 expect(parseMediaSource("https://open.spotify.com/intl-en/track/4uLU6hMCjMI75M1A2tKUQC")?.provider).toBe("spotify");
 expect(parseMediaSource("spotify:track:4uLU6hMCjMI75M1A2tKUQC")?.url).toBe("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
});
test("rejects arbitrary pages, disguised hosts and unsupported Twitch Clips",()=>{
 for(const link of ["javascript:alert(1)","https://vimeo.com.attacker.com/12345","https://vimeo.com@attacker.com/12345","https://user:secret@vimeo.com/12345","https://vimeo.com:8080/12345","https://clips.twitch.tv/Example","https://www.twitch.tv/user/clip/Example","https://www.tiktok.com/@user","https://open.spotify.com/evil/4uLU6hMCjMI75M1A2tKUQC"]){expect(parseMediaSource(link)).toBe(null);}
 expect(isMediaSource({provider:"vimeo",id:"123",url:"https://www.youtube.com/watch?v=aqz-KE-bpKQ",kind:"video"})).toBe(false);
});
test("reports provider limits and keeps live/audio out of movie coverage",()=>{
 const live=parseMediaSource("https://www.twitch.tv/monstercat")!;
 expect(mediaCapabilities(live)).toMatchObject({live:true,seek:false,timeline:false,rate:false});
 expect(mediaCapabilities(parseMediaSource("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")!)).toMatchObject({mute:false,volume:false,rate:false,timeline:false});
 expect(mediaCapabilities(parseMediaSource("https://www.tiktok.com/@user/video/7527476667770522893")!)).toMatchObject({mute:true,volume:false,rate:false,timeline:true});
});

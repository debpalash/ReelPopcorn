import { expect, test } from "nsh/test";
import { parseVideoLink } from "./video";

test("parses YouTube formats and timestamps", () => {
  for (const url of ["aqz-KE-bpKQ", "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "youtu.be/aqz-KE-bpKQ", "https://m.youtube.com/shorts/aqz-KE-bpKQ", "https://youtube.com/live/aqz-KE-bpKQ"]) {
    expect(parseVideoLink(url)?.id).toBe("aqz-KE-bpKQ");
  }
  expect(parseVideoLink("https://youtu.be/aqz-KE-bpKQ?t=1h2m3s")?.startSeconds).toBe(3723);
  expect(parseVideoLink("https://youtube.com/watch?v=aqz-KE-bpKQ&start=30")?.startSeconds).toBe(30);
});

test("rejects untrusted hosts, scripts and malformed IDs", () => {
  for (const url of ["javascript:alert(1)", "https://youtube.com.evil.test/watch?v=aqz-KE-bpKQ", "https://evil.test/aqz-KE-bpKQ", "https://youtube.com/watch?v=x", "", "<script>bad</script>"]) {
    expect(parseVideoLink(url)).toBe(null);
  }
});

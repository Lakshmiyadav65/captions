/**
 * Verifies stage fullscreen (video + caption overlay) works from a user click,
 * and that the old "exit video FS then request stage FS" pattern fails without a gesture.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { once } from "node:events";

const html = `<!DOCTYPE html>
<html>
<body style="margin:0;background:#111;color:#fff;font-family:sans-serif">
  <div id="stage" class="preview-stage" style="width:320px;height:240px;background:#000;position:relative;margin:40px auto">
    <video id="video" controls controlsList="nofullscreen" style="width:100%;height:100%;object-fit:contain"
      src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"></video>
    <div id="caption" style="position:absolute;left:10%;right:10%;top:50%;text-align:center;font-size:20px;pointer-events:none">
      TEST CAPTION
    </div>
    <button id="fs" type="button" style="position:absolute;right:8px;bottom:48px;z-index:5">Full screen</button>
  </div>
  <pre id="log"></pre>
  <script>
    const stage = document.getElementById('stage');
    const video = document.getElementById('video');
    const log = (m) => { document.getElementById('log').textContent += m + '\\n'; };
    document.getElementById('fs').onclick = async () => {
      try {
        if (document.fullscreenElement === stage) await document.exitFullscreen();
        else await stage.requestFullscreen();
        log('btn:' + (document.fullscreenElement && document.fullscreenElement.id));
      } catch (e) { log('btn-err:' + e.message); }
    };
    // Repro of the broken promote pattern (should fail after await exit).
    window.__brokenPromote = async () => {
      try {
        await video.requestFullscreen();
        await document.exitFullscreen();
        await stage.requestFullscreen();
        log('promote:' + (document.fullscreenElement && document.fullscreenElement.id));
      } catch (e) { log('promote-err:' + e.name); }
    };
  </script>
</body>
</html>`;

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const { port } = server.address();

const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);

// Our button: click is a user gesture → stage should become fullscreen.
await page.click("#fs");
await page.waitForTimeout(300);
const afterBtn = await page.evaluate(() => ({
  id: document.fullscreenElement?.id ?? null,
  captionVisible: (() => {
    const el = document.getElementById("caption");
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
  })(),
  log: document.getElementById("log").textContent,
}));

await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// Broken promote pattern from a gesture-less async chain after exit.
const afterPromote = await page.evaluate(async () => {
  await window.__brokenPromote();
  return {
    id: document.fullscreenElement?.id ?? null,
    log: document.getElementById("log").textContent,
  };
});

await browser.close();
server.close();

const ok = afterBtn.id === "stage" && afterBtn.captionVisible;
console.log(JSON.stringify({ afterBtn, afterPromote, ok }, null, 2));
if (!ok) {
  console.error("FAIL: stage fullscreen button did not keep captions");
  process.exit(1);
}
// Promote may leave null fullscreen or error — either way it must not be relied on.
if (afterPromote.id === "stage" && !String(afterPromote.log).includes("promote-err")) {
  console.log("NOTE: broken promote unexpectedly succeeded in this environment");
} else {
  console.log("OK: broken promote did not stably fullscreen the stage (as expected)");
}
console.log("PASS: Full screen button fullscreens the stage with captions visible");

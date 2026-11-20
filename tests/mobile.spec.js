import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const MISSING = "Not recorded yet. Record it once in Voice Memos and it plays here.";
const DENY = /\bmeaning\b|\btranslation\b|\btranslates\b|\bmeans\b|I bow|obeisance|goddess of|wish-fulfilling|wish fulfilling|destroyer of|remover of obstacles|salutations to/i;
const SCRIPT = /[\u0900-\u097F\u0C80-\u0CFF]/;

const VERIFIED = {
  gajananam: {
    title: "Gajaananam",
    lines: [
      "Gajaananam bhoota-ganaadi sevitam",
      "Kapittha jamboo phala saara bhakshitam",
      "Umaa-sutam shoka vinaasha kaaranam",
      "Namaami vighneshwara paada pankajam",
    ],
  },
  saraswati: {
    title: "Saraswati Namastubhyam",
    lines: [
      "Saraswati namastubhyam",
      "Varade kaamaroopini",
      "Vidyaarambham karishyaami",
      "Siddhir bhavatu me sadaa",
    ],
  },
  raghavendra: {
    title: "Poojyaaya Raaghavendraaya",
    lines: [
      "Poojyaaya raaghavendraaya",
      "Satya-dharma rataaya cha",
      "Bhajataam kalpa-vrukshaaya",
      "Namataam kaamadhenave",
    ],
  },
};

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource|404|net::ERR/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const pending = document.getAnimations().filter((anim) => {
      const timing = anim.effect && anim.effect.getTiming();
      return timing && timing.iterations !== Infinity;
    });
    await Promise.all(pending.map((anim) => anim.finished.catch(() => {})));
  });
  await page.waitForFunction(() => {
    const visible = [...document.images].filter((img) => img.getBoundingClientRect().width > 0);
    return visible.length > 0 && visible.every((img) => img.complete && img.naturalWidth > 0);
  });
}

async function expectLayout(page) {
  await settle(page);
  const problems = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const problems = [];
    const deny = /\bmeaning\b|\btranslation\b|\btranslates\b|\bmeans\b|I bow|obeisance|goddess of|wish-fulfilling|wish fulfilling|destroyer of|remover of obstacles|salutations to/i;
    const script = /[\u0900-\u097F\u0C80-\u0CFF]/;
    if (document.documentElement.scrollWidth > width + 1) {
      problems.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${width})`);
    }
    for (const el of document.body.querySelectorAll("*")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const box = el.getBoundingClientRect();
      if (box.width < 1 && box.height < 1) continue;
      if (box.right > width + 1.5 || box.left < -1.5) {
        const name = `${el.tagName}.${String(el.className).slice(0, 40)}`;
        problems.push(`${name} sticks out (${box.left.toFixed(1)}–${box.right.toFixed(1)})`);
      }
    }
    for (const img of document.querySelectorAll("img")) {
      const box = img.getBoundingClientRect();
      if (box.width < 1) continue;
      const fit = getComputedStyle(img).objectFit;
      if (fit !== "contain") problems.push(`object-fit is ${fit}`);
      if (!img.complete || !img.naturalWidth) problems.push(`image not loaded: ${img.currentSrc}`);
      const ratio = img.naturalWidth / img.naturalHeight;
      if (Math.abs(ratio - 4 / 3) > 0.01) problems.push(`image is not 4:3 (${ratio})`);
      const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
      const drawnW = img.naturalWidth * scale;
      const drawnH = img.naturalHeight * scale;
      if (drawnW > box.width + 1 || drawnH > box.height + 1) problems.push("image draws outside its box");
    }
    const text = document.body.innerText;
    if (script.test(text)) problems.push("Indian script is on the page");
    if (deny.test(text)) problems.push("translation text is on the page");
    for (const badge of document.querySelectorAll(".mi .badge")) {
      const thumb = badge.closest(".mi").querySelector(".tm");
      if (!thumb) {
        problems.push("recording mark is not on a thumbnail");
        continue;
      }
      const frame = thumb.getBoundingClientRect();
      const mark = badge.getBoundingClientRect();
      const cx = mark.left + mark.width / 2;
      const cy = mark.top + mark.height / 2;
      if (cx < frame.left - 4 || cx > frame.right + 4 || cy < frame.top - 4 || cy > frame.bottom + 4) {
        problems.push("recording mark sits off its thumbnail");
      }
    }
    return problems.slice(0, 12);
  });
  expect(problems, problems.join("\n")).toEqual([]);
}

test("home, practice, and the sheets stay on the phone", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = trackErrors(page);
  await page.goto("/?on=2026-01-04");
  await expect(page.getByRole("heading", { name: "Gajaananam" })).toBeVisible();
  await expect(page.getByText("Shloka of the week")).toBeVisible();
  await expect(page.getByText("For Ganesha · Week 1 of 2")).toBeVisible();
  await expect(page.getByText("Day 4 of 14")).toBeVisible();
  await expect(page.getByText(MISSING).first()).toBeVisible();
  const play = page.getByRole("button", { name: "Play Amma's voice" });
  await expect(play).toBeDisabled();
  const playBg = await play.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(playBg).not.toBe("rgb(138, 90, 43)");
  await expect(page.locator("iframe, a[href*='youtube'], video")).toHaveCount(0);
  await expect(page.getByText(/kasturi|krishna/i)).toHaveCount(0);

  const days = page.locator(".days .day");
  await expect(days).toHaveCount(14);
  await expect(days.nth(0)).toHaveClass(/\bd\b/);
  await expect(days.nth(2)).toHaveClass(/\bd\b/);
  await expect(days.nth(3)).toHaveClass(/\bt\b/);
  await expect(days.nth(4)).toHaveClass(/^day $/);

  await expect(page.locator(".more-row .mi")).toHaveCount(3);
  await expectLayout(page);

  await page.getByRole("button", { name: "All 3 shlokas" }).click();
  const list = page.getByRole("dialog", { name: "All 3 shlokas" });
  await expect(list).toBeVisible();
  await expect(list.locator("[data-shloka]")).toHaveCount(3);
  await expect(list.getByText("This week")).toBeVisible();
  await list.getByRole("button", { name: /Saraswati Namastubhyam/ }).click();
  await expect(list).toBeHidden();
  await expect(page.getByRole("heading", { name: "Saraswati Namastubhyam" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to this week" })).toBeVisible();
  await expect(page.locator(".fort")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to this week" }).click();
  await expect(page.getByRole("heading", { name: "Gajaananam" })).toBeVisible();
  await expect(page.getByText("Day 4 of 14")).toBeVisible();

  await page.getByRole("button", { name: "Practice" }).click();
  await expect(page.locator("[data-view='practice']")).toBeVisible();
  await expect(page.getByText("Line 1 of 4")).toBeVisible();
  await expect(page.locator("[data-practice-line]")).toHaveText(VERIFIED.gajananam.lines[0]);
  await expect(page.locator(".p-card p")).toHaveCount(1);
  const hear = page.getByRole("button", { name: "Hear it" });
  await expect(hear).toBeDisabled();
  await expect(page.getByRole("button", { name: "Back a line" })).toBeDisabled();
  await expect(page.locator("[data-view='practice'] [data-missing]")).toBeVisible();
  await page.getByRole("button", { name: "Next line" }).click();
  await expect(page.getByText("Line 2 of 4")).toBeVisible();
  await expect(page.locator("[data-practice-line]")).toHaveText(VERIFIED.gajananam.lines[1]);
  await page.getByRole("button", { name: "Back a line" }).click();
  await expect(page.locator("[data-practice-line]")).toHaveText(VERIFIED.gajananam.lines[0]);
  await page.getByRole("button", { name: "Next line" }).click();
  await page.getByRole("button", { name: "Next line" }).click();
  await page.getByRole("button", { name: "Next line" }).click();
  await expect(page.getByText("Line 4 of 4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next line" })).toBeDisabled();
  await expect(page.locator("[data-practice-line]")).toHaveText(VERIFIED.gajananam.lines[3]);
  const practiceText = await page.locator("[data-view='practice']").innerText();
  expect(practiceText).not.toMatch(DENY);
  expect(practiceText).not.toMatch(SCRIPT);
  await expectLayout(page);
  await page.getByRole("button", { name: "Gajaananam" }).click();
  await expect(page.locator("[data-view='home']")).toBeVisible();

  expect(errors, errors.join("\n")).toEqual([]);
});

test("whole-shloka line counts match the json and no translation text exists", async ({ page }) => {
  test.setTimeout(60_000);
  const pack = JSON.parse(fs.readFileSync(new URL("../data/shlokas.json", import.meta.url), "utf8"));
  expect(pack.shlokas.map((item) => item.id)).toEqual(["gajananam", "saraswati", "raghavendra"]);
  for (const item of pack.shlokas) {
    expect(item.lines).toEqual(VERIFIED[item.id].lines);
    expect(item.title).toBe(VERIFIED[item.id].title);
    expect(JSON.stringify(item)).not.toMatch(/mean|gloss|translation|notes|sources/i);
    expect(JSON.stringify(item)).not.toMatch(SCRIPT);
  }
  expect(JSON.stringify(pack)).not.toMatch(/kasturi|krishna/i);

  for (const file of ["index.html", "js/app.js", "css/styles.css", "data/shlokas.json"]) {
    const text = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    expect(text, file).not.toMatch(SCRIPT);
    expect(text, file).not.toMatch(/\bmeaning\b|\btranslation\b/i);
    expect(text, file).not.toMatch(/kasturi|krishna/i);
  }

  const errors = trackErrors(page);
  await page.goto("/?on=2026-01-04");
  for (const item of pack.shlokas) {
    if (item.id !== "gajananam") {
      await page.getByRole("button", { name: item.short, exact: true }).click();
    }
    await page.getByRole("button", { name: "See whole shloka" }).click();
    const dialog = page.getByRole("dialog", { name: "Whole shloka" });
    await expect(dialog).toBeVisible();
    const rows = dialog.locator("[data-shloka-line]");
    await expect(rows, item.id).toHaveCount(item.lines.length);
    const texts = (await rows.locator(".t").allTextContents()).map((text) => text.trim());
    expect(texts, item.id).toEqual(item.lines);
    const sizes = await dialog.locator(".t").evaluateAll((nodes) => (
      nodes.map((node) => Number.parseFloat(getComputedStyle(node).fontSize))
    ));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(18);
    const sheet = await dialog.innerText();
    expect(sheet, item.id).not.toMatch(SCRIPT);
    expect(sheet, item.id).not.toMatch(DENY);
    const sheetPlay = dialog.getByRole("button", { name: "Play Amma's voice" });
    await expect(sheetPlay).toBeDisabled();
    const sheetBg = await sheetPlay.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(sheetBg).not.toBe("rgb(138, 90, 43)");
    await expect(dialog.getByText(MISSING)).toBeVisible();
    await expectLayout(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }

  await page.getByRole("button", { name: "Practice" }).click();
  for (const line of VERIFIED.raghavendra.lines) {
    await expect(page.locator("[data-practice-line]")).toHaveText(line);
    const practiceText = await page.locator("[data-view='practice']").innerText();
    expect(practiceText).not.toMatch(DENY);
    const next = page.getByRole("button", { name: "Next line" });
    if (await next.isEnabled()) await next.click();
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the date moves the shloka every fourteen days", async ({ page }) => {
  const cases = [
    ["2026-01-01", "Gajaananam", "Day 1 of 14", "Week 1 of 2"],
    ["2026-01-08", "Gajaananam", "Day 8 of 14", "Week 2 of 2"],
    ["2026-01-14", "Gajaananam", "Day 14 of 14", "Week 2 of 2"],
    ["2026-01-15", "Saraswati Namastubhyam", "Day 1 of 14", "Week 1 of 2"],
    ["2026-01-29", "Poojyaaya Raaghavendraaya", "Day 1 of 14", "Week 1 of 2"],
    ["2026-02-11", "Poojyaaya Raaghavendraaya", "Day 14 of 14", "Week 2 of 2"],
    ["2026-02-12", "Gajaananam", "Day 1 of 14", "Week 1 of 2"],
  ];
  for (const [on, title, day, week] of cases) {
    await page.goto(`/?on=${on}`);
    await expect(page.getByRole("heading", { name: title, exact: true }), on).toBeVisible();
    await expect(page.getByText(day), on).toBeVisible();
    await expect(page.getByText(week), on).toBeVisible();
  }
});

test("motion stays still when reduced motion is on", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?on=2026-01-04");
  await page.getByRole("button", { name: "See whole shloka" }).click();
  const sheetAnim = await page.locator("#whole .picker-sheet").evaluate((el) => getComputedStyle(el).animationName);
  expect(sheetAnim).toBe("fadeOnly");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Practice" }).click();
  const ring = await page.locator(".st.say .ring").evaluate((el) => getComputedStyle(el).animationName);
  expect(ring).toBe("none");
});

test("a dropped recording can play", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-14", "one phone is enough for audio");
  const silence = "/tmp/samaya-shloka-silence.mp3";
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "1", "-q:a", "9", silence], { stdio: "ignore" });
  await page.route("**/audio/**", async (route) => {
    const url = route.request().url();
    if (url.includes("gajananam.mp3")) {
      await route.fulfill({ status: 200, contentType: "audio/mpeg", body: fs.readFileSync(silence) });
      return;
    }
    await route.fulfill({ status: 404, body: "missing" });
  });
  await page.goto("/?on=2026-01-04");
  const play = page.getByRole("button", { name: "Play Amma's voice" });
  await expect(play).toBeEnabled();
  await expect(page.locator("[data-missing]:visible")).toHaveCount(0);
  await play.click();
  await expect(page.getByRole("button", { name: "Pause Amma's voice" })).toBeVisible();
  await page.getByRole("button", { name: "Pause Amma's voice" }).click();
  await expect(page.getByRole("button", { name: "Play Amma's voice" })).toBeEnabled();

  await page.getByRole("button", { name: "Practice" }).click();
  const hear = page.getByRole("button", { name: "Hear it" });
  await expect(hear).toBeEnabled();
  await hear.click();
  await expect(page.getByText("Heard")).toBeVisible({ timeout: 8000 });
});

test("iphone 14 screenshots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-14");
  const dir = "/opt/cursor/artifacts";
  await page.goto("/?on=2026-01-04");
  await settle(page);
  await page.screenshot({ path: `${dir}/iphone14-home.png`, fullPage: false });

  await page.getByRole("button", { name: "See whole shloka" }).click();
  const sheet = page.getByRole("dialog", { name: "Whole shloka" });
  await expect(sheet).toBeVisible();
  await sheet.evaluate(async (el) => {
    await Promise.all(el.getAnimations({ subtree: true }).map((anim) => anim.finished));
  });
  await page.screenshot({ path: `${dir}/iphone14-whole.png`, fullPage: false });
  await sheet.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Practice" }).click();
  await page.getByRole("button", { name: "Next line" }).click();
  await expect(page.getByText("Line 2 of 4")).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${dir}/iphone14-practice.png`, fullPage: false });
});

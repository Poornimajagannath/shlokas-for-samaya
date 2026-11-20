# Shlokas for Samaya

A phone page for one shloka at a time. Amma chants, Samaya listens, and they say one line together. The labels are English. The shloka is only the verified lines, written in English letters.

Open it at [https://poornimajagannath.github.io/shlokas-for-samaya/](https://poornimajagannath.github.io/shlokas-for-samaya/) after it is published from `main`.

## What you see

The page opens on this fortnight’s shloka.

- **Play Amma's voice** plays the recording for that shloka. Until the file is there, the button is dimmed and the page says it is not recorded yet.
- **See whole shloka** opens every line in a sheet.
- **Practice** shows one line. Hear it, then you say it. Back a line and Next line move through the shloka.
- **Two weeks with this shloka** is a 14-day bar. The day follows the date in Los Angeles. The cycle starts on Friday 20 November 2026 with Gajaananam, then Saraswati Namastubhyam, then Poojyaaya Raaghavendraaya, then Gajaananam again.
- **Coming up** and **All 3 shlokas** let you look at the other two. **Back to this week** returns to the one the date chose.

## Add Amma’s recording

Record the shloka in Voice Memos, then put the file in `audio/`. Name it with the shloka id. `.m4a` or `.mp3` both work.

| Shloka | File |
| --- | --- |
| Gajaananam | `audio/gajananam.m4a` |
| Saraswati Namastubhyam | `audio/saraswati.m4a` |
| Poojyaaya Raaghavendraaya | `audio/raghavendra.m4a` |

Commit the file and push to `main` so the published page can play it.

## Notes

There is no video, no analytics, and no font loaded from the network. Noto Sans is the only typeface, in `fonts/NotoSans.ttf`. The pictures stay full, at 4:3, inside their frames. The lines live in `data/shlokas.json` and are shown as written there.

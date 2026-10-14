# Media checklist: what to upload and where

**Why this list exists.** You asked for genuine photos and footage of the exact brush in your Amazon listing, and for the build to stop and ask rather than substitute anything. The build environment's network policy blocked `amazon.com`, so no listing image or video could be retrieved, and nothing was made up. The theme is built so each slot shows your real media the moment you upload it, and stays empty for shoppers until then.

## Before you upload: confirm you may use the media

Images and videos on an Amazon listing belong to the seller or brand that published them (the URL points to a listing under the name "Rorhxia"). Copying them onto another store without permission can infringe copyright and Amazon's terms. The safest source is your supplier's own media pack, or footage and photos you shoot yourself of the actual brush. Ask your supplier for written permission to use their images and video.

## Gallery photos (Products > the brush > Media)

Upload in this order. Shopify shows them in this order, and the first one is the main image.

| # | What it must show | Also used in (theme editor) |
| --- | --- | --- |
| 01 | Main image: the brush on white (listing image 1) | Home > **Hero** > Main product photo |
| 02 | Close-up of the bristles and brush head | Home > **Product introduction** > Main photo |
| 03 | The self-cleaning feature | Product > **Feature details** > "Self-Cleaning Design" > Photo |
| 04 | The mist function and water tank | Feature details > "Steam Mist" > Photo |
| 05 | The IPX7 waterproof rating | Feature details > "IPX7 Waterproof" > Photo |
| 06 | What is in the box (exactly what ships) | Home > **Closing call to action** > Photo |
| 07 | Lifestyle: the brush on a dog (only if genuine) | Home > Product introduction > Small overlapping photo; Product > **How it works** > Step 1 > Photo |
| 08 | Lifestyle: the brush on a cat (only if genuine) | How it works > Step 3 > Photo |

If a photo does not exist, leave that slot empty. Do not fill it with a similar-looking product.

## Looping videos (muted, 3 to 8 seconds)

You asked for these four, in this order of priority. Use only genuine footage of the exact brush.

| Loop | What it must show | Where it goes |
| --- | --- | --- |
| A | The brush being used on a **dog's coat** | Products > the brush > Media (as a video); Home > **Demo videos** > Main video |
| B | The brush being used on a **cat's coat** | Product media (as a video); Product > How it works > Step 3 > Looping video |
| C | A close-up of the **self-cleaning mechanism** in action | Home > Demo videos > Second video; Product > Feature details > Feature video; How it works > Step 2 > Looping video |
| D | A close-up of **another feature the footage genuinely shows** (for example the mist, only if it is visible) | Product media (as a video) |

Shown on the page as plain product demonstrations. The words "GIF" appear nowhere on the site.

### Preparing a loop

Use `scripts/make-loop.sh` (needs [ffmpeg](https://ffmpeg.org)). It trims, crops and scales your footage and blends the end into the start so there is no visible jump. It adds no effects.

```bash
# dog coat: 4 second loop starting 12.5 s into the clip, 1280 px wide, 0.5 s crossfade
scripts/make-loop.sh supplier-clip.mp4 12.5 4 loop-dog --width 1280

# vertical 4:5 version for the mobile hero demo
scripts/make-loop.sh supplier-clip.mp4 12.5 4 loop-dog-mobile --crop 4:5 --width 1080
```

It writes `loop-dog.mp4` (upload this), `loop-dog.webm` (optional) and `loop-dog-poster.jpg` (the cover image). Aim for under about 3 MB each. If the footage already loops cleanly, add `--crossfade 0`.

I compared the loop point with and without the crossfade on synthetic test footage. The jump at the seam was as smooth as two consecutive source frames with the crossfade and clearly visible without it. It has not yet been run on your real footage, so check each loop by eye. A fast-moving pet can look ghosted during a 0.5 s blend. Use a shorter crossfade or pick a calmer moment.

### Why MP4 and WebM, not GIFs

MP4 and WebM loops are many times smaller than the same clip as a GIF, play smoothly on phones and keep the real colours. You asked for those wherever they load better, so every loop on the site is a video. Nothing on the storefront needs a GIF file.

### Uploading videos

- **Gallery:** Products > the brush > Media > Add > upload the MP4.
- **Theme editor slots:** in the section's **Video (uploaded to Shopify)** field choose **Select video** and upload the MP4. Alternatively paste a direct MP4 or WebM file link (for example from **Content > Files**) into **Or direct MP4 / WebM link**.
- Upload the poster JPG as the slot's **Cover image** for a nicer first frame.
- Give each video a short, honest caption or description. Captions are shown on the video and read to screen readers.

## Photo specs

| Item | Recommendation |
| --- | --- |
| Format | JPG or PNG (WebP also works). Shopify serves optimised copies. |
| Size | At least 1600 px on the long side. Square (1:1) for the gallery. |
| Background | Product photos on white look best against the peach frames. |
| Alt text | Describe what is shown. Add it on the product media or in each section's "Photo description" field. |

## What stays hidden until you upload

- The Home **Demo videos** section is hidden from shoppers until at least one video is added.
- Empty photo slots are not shown. The hero, introduction and closing sections close up around the gap.
- The product gallery shows the Pawora paw mark with "Product images coming soon" until the product has media.

Inside the theme editor every empty slot shows a dashed outline with the slot name (PHOTO 01 to PHOTO 08, VIDEO 01 and 02) so you can see where each file goes. Shoppers never see these.

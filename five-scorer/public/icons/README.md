# Icons

Place PWA icons here:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Quick placeholder generation (ImageMagick):

```bash
convert -size 512x512 xc:"#0b1220" \
  -fill "#22c55e" -gravity center \
  -pointsize 220 -font Helvetica-Bold -annotate 0 "5" \
  icon-512.png
convert icon-512.png -resize 192x192 icon-192.png
```

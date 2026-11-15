"""
One-off: read each building's GT Facilities maintenance area off the zone-map screenshot.

    python3 scripts/assign-zones.py

Needs Pillow, NumPy and SciPy (all included with Anaconda). Inputs:
    data/campus.json             building footprints from OpenStreetMap (scripts/fetch-osm.ts)
    data/source/zone-map.png     screenshot of the "GT Facilities Maintenance Areas" web map (not in git)
Outputs:
    data/zones.json              OSM building id -> area + confidence
    data/zone-review.md          buildings a person should double-check
    data/source/zone-debug.png   the screenshot with our footprints drawn on top (for eyeballing)

How it works:
  1. Sample the ten legend colours from the legend swatches in the image.
  2. Label every map pixel with the legend colour it matches (or "none").
  3. Line the screenshot up with the OSM footprints: a first guess from two landmarks
     (McCamish Pavilion and Bobby Dodd Stadium), then a search over scale + rotation + offset for the
     placement where the most coloured pixels land inside footprints.
  4. For each footprint, look at the pixels under it and take a vote.

To correct a building by hand, edit data/zone-overrides.json (it is never overwritten).
"""
import json
from collections import Counter
from datetime import date

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

IMG = "data/source/zone-map.png"
AREAS = ["area1", "area2", "area3", "area4", "area5", "area6", "gtaa", "housing", "parking", "non_gt"]
LABELS = {"area1": "Area 1", "area2": "Area 2", "area3": "Area 3", "area4": "Area 4", "area5": "Area 5", "area6": "Area 6",
          "gtaa": "GTAA", "housing": "Housing", "parking": "Parking", "non_gt": "Non-GT"}
# Legend swatches sit in this column of the screenshot; rows are found automatically.
LEGEND_X = (1740, 1795)
LEGEND_Y = (640, 1330)
# Parts of the map hidden behind UI: the legend panel and the search box. (x0, y0, x1, y1)
HIDDEN = [(1686, 500, 2318, 1424), (1800, 0, 2318, 40), (0, 1368, 2318, 1424)]

img = np.array(Image.open(IMG).convert("RGB")).astype(np.int32)  # int32: squared colour differences overflow int16
H, W, _ = img.shape
campus = json.load(open("data/campus.json"))
buildings = campus["buildings"]

# ───────── 1. legend colours, sampled from the pixels ─────────
band = img[LEGEND_Y[0]:LEGEND_Y[1], LEGEND_X[0]:LEGEND_X[1]]
has_ink = (np.abs(band - 255).sum(axis=2) > 60).sum(axis=1) > 5
rows, start = [], None
for y, ink in enumerate(has_ink):
    if ink and start is None:
        start = y
    if not ink and start is not None:
        rows.append((start + LEGEND_Y[0], y + LEGEND_Y[0]))
        start = None
assert len(rows) == len(AREAS), f"expected {len(AREAS)} legend swatches, found {len(rows)}"
legend = {}
for area, (y0, y1) in zip(AREAS, rows):
    px = [tuple(int(v) for v in p) for p in img[y0:y1, LEGEND_X[0]:LEGEND_X[1]].reshape(-1, 3)]
    # most common colour that isn't white or the grey outline
    colour = next(c for c, _ in Counter(px).most_common() if sum(abs(v - 255) for v in c) > 40 and c != (110, 110, 110))
    legend[area] = colour
print("Legend colours sampled from the image:")
for a in AREAS:
    print(f"  {LABELS[a]:8s} #{legend[a][0]:02x}{legend[a][1]:02x}{legend[a][2]:02x}")

# ───────── 2. label every pixel ─────────
palette = np.array([legend[a] for a in AREAS], dtype=np.int32)
dist = np.sqrt(((img[:, :, None, :] - palette[None, None, :, :]) ** 2).sum(axis=3))
label = dist.argmin(axis=2).astype(np.int8)
# Fills on the map are flat colour, so matches are tight. Grey needs a stricter test: the basemap is full of greys.
tol = np.where(label == AREAS.index("non_gt"), 10, 34)
label[dist.min(axis=2) > tol] = -1
hidden = np.zeros((H, W), bool)
for x0, y0, x1, y1 in HIDDEN:
    hidden[y0:y1, x0:x1] = True
label[hidden] = -1
coloured = label >= 0
# Plain basemap: light, unlabelled pixels. (Dark outlines and label text are neither zone colour nor basemap.)
basemap = (label < 0) & (img.min(axis=2) > 205) & ~hidden

# ───────── 3. line the screenshot up with OSM ─────────
def ring_area(r):
    xs, zs = r[0::2], r[1::2]
    return abs(sum(xs[i] * zs[(i + 1) % len(xs)] - xs[(i + 1) % len(xs)] * zs[i] for i in range(len(xs)))) / 2

def blob_centre(mask, near):
    """Centre of the biggest connected blob of `mask` whose centre is within 150px of `near`."""
    lab, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    centres = ndimage.center_of_mass(mask, lab, range(1, n + 1))
    best = max((i for i in range(n) if abs(centres[i][1] - near[0]) < 150 and abs(centres[i][0] - near[1]) < 150), key=lambda i: sizes[i])
    return centres[best][1], centres[best][0]

gtaa = label == AREAS.index("gtaa")
mccamish_px = blob_centre(gtaa, (950, 380))    # round blue arena, top of campus
stadium_px = blob_centre(gtaa, (970, 830))     # big blue stadium, bottom of campus
mccamish = next(b for b in buildings if b["name"] and "McCamish" in b["name"])
stadium = max((b for b in buildings if abs(b["x"] - 434) < 200 and abs(b["z"] - 366) < 200), key=lambda b: ring_area(b["rings"][0]))
px_d = np.hypot(stadium_px[0] - mccamish_px[0], stadium_px[1] - mccamish_px[1])
m_d = np.hypot(stadium["x"] - mccamish["x"], stadium["z"] - mccamish["z"])
s0 = px_d / m_d
tx0, ty0 = mccamish_px[0] - s0 * mccamish["x"], mccamish_px[1] - s0 * mccamish["z"]

# Raster of all OSM footprints at 1 px per metre, for fast "is this point inside a building?" lookups.
EXT = 1800
raster_img = Image.new("L", (2 * EXT, 2 * EXT), 0)
draw = ImageDraw.Draw(raster_img)
for b in buildings:
    for i, r in enumerate(b["rings"]):
        draw.polygon([(r[k] + EXT, r[k + 1] + EXT) for k in range(0, len(r), 2)], fill=1 if i == 0 else 0)
raster = np.array(raster_img, dtype=np.uint8)

ys, xs = np.nonzero(coloured)
rng = np.random.default_rng(0)

def sampler(n):
    pick = rng.choice(len(xs), size=min(n, len(xs)), replace=False)
    px, py = xs[pick].astype(np.float64), ys[pick].astype(np.float64)

    def score(scale, theta, tx, ty):
        """Share of coloured pixels that land inside an OSM footprint, for pixel = scale * rotate(theta) * metres + t."""
        c, s_ = np.cos(theta), np.sin(theta)
        dx, dy = (px - tx) / scale, (py - ty) / scale
        mx = np.round(c * dx + s_ * dy + EXT).astype(int)   # inverse rotation
        mz = np.round(-s_ * dx + c * dy + EXT).astype(int)
        ok = (mx >= 0) & (mx < 2 * EXT) & (mz >= 0) & (mz < 2 * EXT)
        return raster[mz[ok], mx[ok]].sum() / len(px)

    return score

# The web map turned out to be rotated a few degrees from true north, so the fit is
# scale + rotation + offset. Rotation is searched about the middle of campus (pivot),
# which keeps the offset search small. Coarse pass first, then two finer ones.
first_guess = sampler(40000)(s0, 0.0, tx0, ty0)
pivot_px = np.array([760.0, 600.0])
pivot_m = (pivot_px - np.array([tx0, ty0])) / s0

def offsets(scale, theta, shift):
    """Translation that keeps the pivot (plus a small shift) fixed for this scale + rotation."""
    c, s_ = np.cos(theta), np.sin(theta)
    rot = np.array([[c, -s_], [s_, c]])
    return pivot_px + shift - scale * rot @ pivot_m

best = (-1.0, s0, 0.0, np.zeros(2))
for n, span_s, span_r, span_t, n_s, n_r, n_t in [(6000, 0.08, 10.0, 40, 17, 41, 17), (20000, 0.01, 0.6, 5, 9, 13, 11), (40000, 0.003, 0.15, 1.5, 7, 7, 7)]:
    score = sampler(n)
    _, c_s, c_r, c_shift = best
    for scale in np.linspace(c_s * (1 - span_s), c_s * (1 + span_s), n_s):
        for theta in np.radians(np.linspace(np.degrees(c_r) - span_r, np.degrees(c_r) + span_r, n_r)):
            for ddx in np.linspace(-span_t, span_t, n_t):
                for ddy in np.linspace(-span_t, span_t, n_t):
                    shift = c_shift + np.array([ddx, ddy])
                    tx, ty = offsets(scale, theta, shift)
                    sc = score(scale, theta, tx, ty)
                    if sc > best[0]:
                        best = (sc, scale, theta, shift)
_, S, THETA, shift = best
TX, TY = offsets(S, THETA, shift)
fit = sampler(40000)(S, THETA, TX, TY)
COS, SIN = np.cos(THETA), np.sin(THETA)
print(f"\nAlignment: {1 / S:.3f} m per pixel, map rotated {np.degrees(THETA):+.2f}°; {fit:.1%} of coloured pixels fall inside an OSM footprint (landmark guess {first_guess:.1%})")

def to_px(x, z):
    return S * (COS * x - SIN * z) + TX, S * (SIN * x + COS * z) + TY

def to_latlng(px, py):
    o = {"lat": 33.7758, "lng": -84.3975}
    dx, dy = (px - TX) / S, (py - TY) / S
    x, z = COS * dx + SIN * dy, -SIN * dx + COS * dy
    return o["lat"] - z / 110540, o["lng"] + x / (111320 * np.cos(np.radians(o["lat"])))

# ───────── 4. vote per building ─────────
zones, review = {}, []
claimed = np.zeros((H, W), bool)
by_id = {b["id"]: b for b in buildings}

def note(b, guess, reason, conf=None):
    review.append({"id": b["id"], "name": b["name"], "ref": b["ref"], "guess": guess, "reason": reason, "conf": conf, "lat": b["lat"], "lng": b["lng"]})

for b in buildings:
    outline = [to_px(b["rings"][0][k], b["rings"][0][k + 1]) for k in range(0, len(b["rings"][0]), 2)]
    x0, y0 = int(min(p[0] for p in outline)) - 1, int(min(p[1] for p in outline)) - 1
    x1, y1 = int(max(p[0] for p in outline)) + 2, int(max(p[1] for p in outline)) + 2
    if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
        continue  # off the screenshot
    x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
    m = Image.new("L", (x1 - x0, y1 - y0), 0)
    d = ImageDraw.Draw(m)
    d.polygon([(p[0] - x0, p[1] - y0) for p in outline], fill=1)
    for r in b["rings"][1:]:
        d.polygon([(to_px(r[k], r[k + 1])[0] - x0, to_px(r[k], r[k + 1])[1] - y0) for k in range(0, len(r), 2)], fill=0)
    mask = np.array(m, bool)
    n = int(mask.sum())
    if n == 0:
        continue
    under_ui = hidden[y0:y1, x0:x1][mask].mean()
    labels = label[y0:y1, x0:x1][mask]
    votes = Counter(int(v) for v in labels if v >= 0)
    # Every shape on the map has a dark outline a couple of pixels wide, which eats a large share of a
    # thin building (most residence halls). So measure colour against basemap, ignoring outline/text pixels.
    n_base = int(basemap[y0:y1, x0:x1][mask].sum())
    n_zone = sum(votes.values())
    covered = n_zone / max(n_zone + n_base, 1) if n_zone + n_base >= 0.3 * n else n_zone / n
    if under_ui > 0.5:
        continue  # hidden behind the legend or search box: can't tell, treat as surrounding city
    if not votes or covered < 0.25:
        continue  # plain basemap underneath: not a GT building
    (top, top_n), *rest = votes.most_common()
    share = top_n / sum(votes.values())
    area = AREAS[top]
    conf = round(covered * share, 2)
    if covered < 0.5:
        # Some colour underneath but less than half: probably a neighbour's colour bleeding over. Don't assign.
        if n >= 12:
            note(b, area, f"only {covered:.0%} of the footprint is coloured; left as not-GT", conf)
        continue
    zones[b["id"]] = {"area": area, "conf": conf}
    claimed[y0:y1, x0:x1] |= mask
    if share < 0.85 and rest:
        note(b, area, f"two colours under one footprint: {share:.0%} {LABELS[area]}, {rest[0][1] / sum(votes.values()):.0%} {LABELS[AREAS[rest[0][0]]]}", conf)
    elif covered < 0.7:
        note(b, area, f"only {covered:.0%} of the footprint is coloured (label text or misaligned outline?)", conf)
    if area != "non_gt":
        if not b["name"]:
            note(b, area, "no name in OpenStreetMap", conf)

# Coloured shapes on the map that no OSM footprint claimed: GT buildings missing (or drawn differently) in OSM.
grown = ndimage.binary_dilation(claimed, iterations=3)
orphans, n_orph = ndimage.label(coloured & ~grown)
missing = []
for i in range(1, n_orph + 1):
    blob = orphans == i
    size = int(blob.sum())
    if size < 120:
        continue
    cy, cx = ndimage.center_of_mass(blob)
    area = AREAS[Counter(int(v) for v in label[blob]).most_common(1)[0][0]]
    lat, lng = to_latlng(cx, cy)
    missing.append({"area": area, "lat": round(float(lat), 5), "lng": round(float(lng), 5), "size_m2": round(size / S ** 2), "px": (round(cx), round(cy))})
missing.sort(key=lambda m: -m["size_m2"])

# ───────── write results ─────────
out = {
    "source": "GT Facilities Maintenance Areas web map (screenshot), sampled by scripts/assign-zones.py",
    "generated": date.today().isoformat(),
    "legend": {a: "#%02x%02x%02x" % legend[a] for a in AREAS},
    "alignment": {"metres_per_pixel": round(1 / S, 4), "rotation_deg": round(float(np.degrees(THETA)), 2), "fit": round(float(fit), 3)},
    "zones": zones,
}
json.dump(out, open("data/zones.json", "w"), indent=1)

counts = Counter(z["area"] for z in zones.values())
gt = {i: z for i, z in zones.items() if z["area"] != "non_gt"}
print(f"\n{len(zones)} buildings matched a zone colour ({len(gt)} GT, {counts['non_gt']} marked Non-GT); {len(buildings) - len(zones)} are surrounding city")
for a in AREAS:
    print(f"  {LABELS[a]:8s} {counts[a]:3d}")
print(f"GT buildings with a name: {sum(1 for i in gt if by_id[i]['name'])}/{len(gt)}; with a number: {sum(1 for i in gt if by_id[i]['ref'])}/{len(gt)}")
print(f"Flagged for review: {len(review)} notes, plus {len(missing)} coloured shapes with no OSM footprint")

def link(lat, lng):
    return f"[map](https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=19/{lat}/{lng})"

with open("data/zone-review.md", "w") as f:
    f.write("# Maintenance-area review list\n\n")
    f.write(f"Generated {date.today().isoformat()} by `scripts/assign-zones.py`. Areas were read from a screenshot, so these need a human check.\n")
    f.write("To fix one, add it to `data/zone-overrides.json`, for example:\n\n")
    f.write('```json\n{ "w123456": { "area": "area3", "name": "Skiles Classroom Building", "number": "002" } }\n```\n\n')
    f.write("Valid areas: " + ", ".join(f"`{a}`" for a in AREAS) + ". Use `\"area\": null` to mark a building as not GT.\n\n")
    groups = [
        ("Two colours under one footprint", lambda r: r["reason"].startswith("two colours")),
        ("Partly coloured (assigned, but check)", lambda r: "label text" in r["reason"]),
        ("Slightly coloured (NOT assigned, but check)", lambda r: "left as not-GT" in r["reason"]),
        ("GT buildings with no name in OpenStreetMap", lambda r: r["reason"].startswith("no name")),
    ]
    for title, test in groups:
        rows_ = [r for r in review if test(r)]
        f.write(f"## {title} ({len(rows_)})\n\n")
        if not rows_:
            f.write("None.\n\n")
            continue
        f.write("| OSM id | Name | Guessed area | Confidence | Why | Where |\n|---|---|---|---|---|---|\n")
        for r in sorted(rows_, key=lambda r: (r["guess"], r["name"] or "~")):
            f.write(f"| `{r['id']}` | {r['name'] or '(unnamed)'} | {LABELS[r['guess']]} | {r['conf']} | {r['reason']} | {link(r['lat'], r['lng'])} |\n")
        f.write("\n")
    f.write(f"## Coloured on the zone map, but no matching OpenStreetMap building ({len(missing)})\n\n")
    f.write("These shapes are on the GT map but OSM has no footprint there (or draws it differently), so they are missing from the 3D campus.\n\n")
    if missing:
        f.write("| Area on map | Approx. size | Where |\n|---|---|---|\n")
        for m_ in missing:
            f.write(f"| {LABELS[m_['area']]} | {m_['size_m2']} m² | {link(m_['lat'], m_['lng'])} |\n")
    no_number = [by_id[i] for i in gt if not by_id[i]["ref"]]
    f.write(f"\n## GT building numbers\n\nOpenStreetMap has a number for only {len(gt) - len(no_number)} of {len(gt)} GT buildings. The rest are stored without one.\n")

# Debug picture: screenshot with each matched footprint outlined in its legend colour (white = two-colour / low-confidence).
dbg = Image.open(IMG).convert("RGB")
dd = ImageDraw.Draw(dbg)
flagged = {r["id"] for r in review if not r["reason"].startswith("no name")}
for b in buildings:
    pts = [to_px(b["rings"][0][k], b["rings"][0][k + 1]) for k in range(0, len(b["rings"][0]), 2)]
    if b["id"] in zones:
        dd.line(pts + [pts[0]], fill=(0, 0, 0), width=3)
        dd.line(pts + [pts[0]], fill=(255, 255, 255) if b["id"] in flagged else (0, 255, 255), width=1)
    else:
        dd.line(pts + [pts[0]], fill=(255, 0, 255) if b["id"] in flagged else (120, 120, 120), width=1)
for m_ in missing:
    x, y = m_["px"]
    dd.ellipse([x - 9, y - 9, x + 9, y + 9], outline=(255, 0, 0), width=3)
dbg.save("data/source/zone-debug.png")
print("\nWrote data/zones.json, data/zone-review.md and data/source/zone-debug.png")

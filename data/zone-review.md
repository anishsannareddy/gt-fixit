# Maintenance-area review list

Generated 2026-11-14 by `scripts/assign-zones.py`. Areas were read from a screenshot, so these need a human check.
To fix one, add it to `data/zone-overrides.json`, for example:

```json
{ "w123456": { "area": "area3", "name": "Skiles Classroom Building", "number": "002" } }
```

Valid areas: `area1`, `area2`, `area3`, `area4`, `area5`, `area6`, `gtaa`, `housing`, `parking`, `non_gt`. Use `"area": null` to mark a building as not GT.

## Two colours under one footprint (1)

| OSM id | Name | Guessed area | Confidence | Why | Where |
|---|---|---|---|---|---|
| `w974793135` | Jimmy John's | Area 1 | 0.6 | two colours under one footprint: 80% Area 1, 20% Non-GT | [map](https://www.openstreetmap.org/?mlat=33.775075&mlon=-84.40048#map=19/33.775075/-84.40048) |

## Partly coloured (assigned, but check) (4)

| OSM id | Name | Guessed area | Confidence | Why | Where |
|---|---|---|---|---|---|
| `w42706681` | Georgia Tech Office of Information Technology Engineering Building | Area 4 | 0.66 | only 69% of the footprint is coloured (label text or misaligned outline?) | [map](https://www.openstreetmap.org/?mlat=33.773779&mlon=-84.394459#map=19/33.773779/-84.394459) |
| `w178658172` | Commander Building | Housing | 0.67 | only 68% of the footprint is coloured (label text or misaligned outline?) | [map](https://www.openstreetmap.org/?mlat=33.77889&mlon=-84.403945#map=19/33.77889/-84.403945) |
| `w454804208` | Glenn-Towers Connector | Housing | 0.62 | only 69% of the footprint is coloured (label text or misaligned outline?) | [map](https://www.openstreetmap.org/?mlat=33.77375&mlon=-84.391298#map=19/33.77375/-84.391298) |
| `w42706743` | Harris Residence Hall | Housing | 0.66 | only 68% of the footprint is coloured (label text or misaligned outline?) | [map](https://www.openstreetmap.org/?mlat=33.772072&mlon=-84.391728#map=19/33.772072/-84.391728) |

## Slightly coloured (NOT assigned, but check) (6)

| OSM id | Name | Guessed area | Confidence | Why | Where |
|---|---|---|---|---|---|
| `w1355836113` | George Tower | Scheller Tower | Area 5 | 0.43 | only 44% of the footprint is coloured; left as not-GT | [map](https://www.openstreetmap.org/?mlat=33.777304&mlon=-84.388182#map=19/33.777304/-84.388182) |
| `w270006398` | (unnamed) | Area 5 | 0.48 | only 48% of the footprint is coloured; left as not-GT | [map](https://www.openstreetmap.org/?mlat=33.773801&mlon=-84.407099#map=19/33.773801/-84.407099) |
| `r3249305` | Jack C. Stein and Goldin Houses | Housing | 0.24 | only 27% of the footprint is coloured; left as not-GT | [map](https://www.openstreetmap.org/?mlat=33.775277&mlon=-84.391594#map=19/33.775277/-84.391594) |
| `w269845839` | (unnamed) | Non-GT | 0.27 | only 27% of the footprint is coloured; left as not-GT | [map](https://www.openstreetmap.org/?mlat=33.787194&mlon=-84.40646#map=19/33.787194/-84.40646) |
| `w269885914` | (unnamed) | Non-GT | 0.4 | only 40% of the footprint is coloured; left as not-GT | [map](https://www.openstreetmap.org/?mlat=33.774433&mlon=-84.390933#map=19/33.774433/-84.390933) |
| `w886581516` | (unnamed) | Non-GT | 0.28 | only 28% of the footprint is coloured; left as not-GT | [map](https://www.openstreetmap.org/?mlat=33.774706&mlon=-84.406652#map=19/33.774706/-84.406652) |

## GT buildings with no name in OpenStreetMap (9)

| OSM id | Name | Guessed area | Confidence | Why | Where |
|---|---|---|---|---|---|
| `w43330604` | (unnamed) | Area 2 | 0.93 | no name in OpenStreetMap | [map](https://www.openstreetmap.org/?mlat=33.781055&mlon=-84.40243#map=19/33.781055/-84.40243) |
| `w43330608` | (unnamed) | Area 2 | 1.0 | no name in OpenStreetMap | [map](https://www.openstreetmap.org/?mlat=33.780808&mlon=-84.40237#map=19/33.780808/-84.40237) |
| `w42706131` | (unnamed) | Area 3 | 1.0 | no name in OpenStreetMap | [map](https://www.openstreetmap.org/?mlat=33.776274&mlon=-84.397252#map=19/33.776274/-84.397252) |
| `w1021745205` | (unnamed) | Area 4 | 0.99 | no name in OpenStreetMap | [map](https://www.openstreetmap.org/?mlat=33.771787&mlon=-84.398464#map=19/33.771787/-84.398464) |
| `r3156682_1` | (unnamed) | GTAA | 0.95 | no name in OpenStreetMap | [map](https://www.openstreetmap.org/?mlat=33.777125&mlon=-84.394678#map=19/33.777125/-84.394678) |
| `r3156682_2` | (unnamed) | GTAA | 1.0 | no name in OpenStreetMap | [map](https://www.openstreetmap.org/?mlat=33.777529&mlon=-84.395161#map=19/33.777529/-84.395161) |
| `w245699027` | (unnamed) | GTAA | 1.0 | no name in OpenStreetMap | [map](https://www.openstreetmap.org/?mlat=33.77275&mlon=-84.392656#map=19/33.77275/-84.392656) |
| `w42706712` | (unnamed) | GTAA | 0.99 | no name in OpenStreetMap | [map](https://www.openstreetmap.org/?mlat=33.772403&mlon=-84.393552#map=19/33.772403/-84.393552) |
| `w43332683` | (unnamed) | GTAA | 1.0 | no name in OpenStreetMap | [map](https://www.openstreetmap.org/?mlat=33.778154&mlon=-84.393866#map=19/33.778154/-84.393866) |

## Coloured on the zone map, but no matching OpenStreetMap building (5)

These shapes are on the GT map but OSM has no footprint there (or draws it differently), so they are missing from the 3D campus.

| Area on map | Approx. size | Where |
|---|---|---|
| Area 5 | 4780 m² | [map](https://www.openstreetmap.org/?mlat=33.77243&mlon=-84.40716#map=19/33.77243/-84.40716) |
| Area 5 | 2966 m² | [map](https://www.openstreetmap.org/?mlat=33.77724&mlon=-84.38829#map=19/33.77724/-84.38829) |
| GTAA | 1755 m² | [map](https://www.openstreetmap.org/?mlat=33.77343&mlon=-84.39234#map=19/33.77343/-84.39234) |
| Area 5 | 1716 m² | [map](https://www.openstreetmap.org/?mlat=33.77384&mlon=-84.40721#map=19/33.77384/-84.40721) |
| Non-GT | 1195 m² | [map](https://www.openstreetmap.org/?mlat=33.78007&mlon=-84.40676#map=19/33.78007/-84.40676) |

## GT building numbers

OpenStreetMap has a number for only 0 of 190 GT buildings. The rest are stored without one.

# Building name changes (round 3)

**Sources:** the two Georgia Tech campus map screenshots (Concept3D) and OpenStreetMap (`data/campus.json`).

**Where the changes live:** every change is in `data/zone-overrides.json`, keyed by OpenStreetMap id. The generated files are not edited.

**Building ids are stable:** `npm run seed` and `npm run buildings:sync` upsert buildings by OSM id, so a renamed building keeps its database id.

**Search:** students can search by a building's name or by any of its aliases, which cover old names and map labels.

**How map labels were matched to footprints:** I fitted the screenshot's pixels to coordinates using known buildings (Paper Tricentennial, Centennial, Mason, Hinman, Clough, Coon, Brittain, Brown). Each label was then matched to the nearest footprint, usually within about 30 m.

## Added (now selectable and reportable)
| OSM id | Name | Area | Notes |
|---|---|---|---|
| w1355836113 | George Tower / Scheller Tower | Area 5 | OSM name "George Tower \| Scheller Tower", with the map label in the same place. Across 5th St from Scheller (Tech Square). Real OSM footprint. |
| w714119667 | Coda Building | Area 5 | The map labels it. The zone map coloured it as not-GT, so the area is your Tech Square choice. |
| w42706826 | Centergy One | Area 5 | Tech Square; the area is your choice. |
| r3321072 | Georgia Tech Hotel & Conference Center | Area 5 | Tech Square; the area is your choice. |
| w886034013 | Biltmore Innovation Center (alias "Biltmore") | Area 5 | Map label "Biltmore". |
| w42726928 | Tenth and Home Building B | Housing | It was the only Tenth & Home building left out. |

## Renamed (old → new)
| OSM id | Old | New |
|---|---|---|
| w42831367 | Flag Building (Charles A. Smithgall Jr. Building) | Charles A. Smithgall, Jr. Student Services Building |
| w43330481 | Institute of Paper Science and Technology | Paper Tricentennial Building |
| w42726641 | Alexander Memorial Coliseum in McCamish Pavilion | McCamish Pavilion |
| w42725820 | The Historic Academy of Medicine | Academy of Medicine |
| w43330499 | John Patrick Crecine Apartments | Crecine Residence Hall |
| w42726177 | O'Keefe Gymnasium | O'Keefe Gym / Women's Softball Locker Rooms |
| w43330545 | Center Street Apartments | Center Street Apartments North |
| w43330596 | Center Street Apartments #2 | Center Street Apartments South |
| w42706709 | Lettie Pate Whithead Evans Administration Building | Lettie Pate Whitehead Evans Administration Building (spelling) |
| w42706740 | Julis L. Brown Residence Hall | Julius L. Brown Residence Hall (spelling) |
| r3156682_1, r3156682_2 | Unnamed building (GTAA) ×2 | Russ Chandler Stadium at Mac Nease Baseball Park (the second becomes "#2") |
| w42706712 | Unnamed building (GTAA) | Bobby Dodd Stadium West Stands |
| w245699027 | Unnamed building (GTAA) | Bobby Dodd Stadium East Stands |
| w43330604, w43330608 | Unnamed building (Area 2) ×2 | 10th Street Plant (the second becomes "#2") |

The old names stay searchable as aliases.

## Kept our name, made the map's name searchable (your choice)
| Our name | Map label |
|---|---|
| Glen P. Robinson, Jr. Building | Molecular Science & Engineering |
| James K. Luck Jr. Facilities Building | ACC Network Production Center |
| Landscape & Construction | Facilities Garage/Warehouse |
| Georgia Tech Research Corporation | 505 10th St NW |
| Georgia Tech Research Institute South Building | 430 10th St (South) |
| ISyE Annex | ISyE Main |

Map short names were also added as aliases, for example Howey Physics, CRC Parking Deck, Love Manufacturing (MRDC II), Skiles Classroom, Clough, Hinman, College of Business, Gray House and Post Office.

## Not sure: left unchanged, please tell me
- **Bud and Val Peterson Residence Hall:** the map shows it west of the Eighth Street Apartments (about 33.7802, −84.4070), but OpenStreetMap has no footprint there. I can draw an approximate footprint if you give me its rough outline or corners, and confirm it is Housing.
- **Nelson / Shell Residence Hall:** the map labels Nelson and Shell separately, but OSM has a single footprint, "Nelson-Shell Residence Hall". Should it be split into two buildings, or stay as one?
- **Three unnamed GT footprints:**
  - `w42706131` (Area 3, next to Van Leer). It may be part of the Blake R. Van Leer Building.
  - `w1021745205` (Area 4, 33.7718, −84.3985).
  - `w43332683` (GTAA, east of Russ Chandler Stadium).

  The map has no label at any of them.
- **The Pavilion ×2 and Jimmy John's (Area 1):** the map labels this spot "Cafe".
- **Off the zone map, not added:**
  - Science Square (formerly Technology Enterprise Park, OSM `w42834555`) and Science Square Labs (`w1317972044`)
  - R. Kirk Landon Learning Center (`w178722004`, the map's "Landing Learning Center")
  - Aircraft Prototyping Laboratory, Digital Fabrication Lab, NARA Substation Control House
  - 512 / 600 Means St, 755 / 793 / 831 / 845 Marietta St, 160 6th St, 162 4th Street, 220 Bobby Dodd Way, 48 5th Street NW.

  Some of these have no OSM footprint in our data; for the others I'd need to know which maintenance area looks after them.
- **Rohr Chabad House** (on the map at OSM's "Broadband Institute Residential Laboratory") and the fraternity and sorority houses: not GT maintenance buildings, so they were left as city context.
- **Southern Regional Education Board:** it's on the zone map (Area 1), so it stays, but it isn't a GT building. Should it be removed?

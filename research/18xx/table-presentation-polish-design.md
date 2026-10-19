# Table presentation polish (1830 playtest)

Shared `@tabletop/18xx-ui` presentation added while playtesting 1830. Each item is a map
view or title presentation option, or shared rendering every title gets.

## Evidence surveyed

The title maps and presentations in this repository (1817, 1830, 1832, 1846, Shikoku 1889,
TOP), their bank and certificate pools, and the 1830 board from `g_1830/map.rb`.

## Per-city names (`MapViewDefinition.cityNames`)

1830 prints one name per city of its double cities (Detroit & Windsor, Hamilton & Toronto,
Dunkirk & Buffalo, Philadelphia & Trenton, New York & Newark); the map data holds one
location name. Other titles' "A & B" names are mostly a town pair (TOP) or an offboard area
(1889's Naruto & Awaji), which keep one straight name. A title opts in by location and city
node; per-city names are presentation, so they stay out of the map data. Each name curves
over its own city's drawn centre, turning off the hex's other cities and names already
placed. Lone-city names now follow the city's drawn centre too, which corrects an
off-centre city such as 1830's Altoona and TOP's Wellington, Summerside and Charlottetown.

## Local lines above stops (`MapMarkerArt.localLine.above`)

A blocker drawn ``above`` sits clear of whatever is printed over the hex's stops: a name
curved over a city, a straight name across the top, or the terrain cost of a hex without
stops. 1830's six blockers and 1889's Takamatsu use it.

## IPO row (`TitlePresentation.ipoPoolId`)

1830, 1832 and 1889 keep unsold shares in a bank `initial-offering` pool; TOP, 1817 and
1846 keep them in the company treasury, which the spreadsheet already shows. A title names
its IPO pool and the spreadsheet adds an IPO row that buys from it like the Market row.

## Price row

Every title's spreadsheet shows the company price row, under the title's price label. The
default label is now Price, so it no longer reads like the Market pool row; TOP keeps Value.

## Bank on the board and its breaking

The board depot shows the bank's cash where the bank is limited (1830, 1832, 1846, 1889)
and "Broken" once it breaks; TOP and 1817 run with an unlimited bank and show nothing. The
history marks the action that broke the bank and reads the title's own scheduled ending
from the recorded state after it, so a title with a different bank ending reports its own.

## Verified by

Harness and playground screenshots of 1830, 1889 and TOP hexes, every title's board depot,
and the 1830 positions used for the stock, train and discard panels.

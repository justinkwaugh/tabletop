# Route reach for construction and stations

`libs/18xx/src/construction/routeReach.ts` decides what a company reaches for tile
lays (`ConstructionReachability`), station placement, train requirements, mergers
and the network display (`ConnectedTrack`/`TrackNetwork`). It replaced two
traversals that followed track by direction only. Those let a route pass a stop
twice: in a TOP game Souris reached Hunter River by entering Emerald Jct, turning
back out of it and taking the other branch of the switch at J16.

## Evidence and family variation

Surveyed `/workspace/research/18xx-2026-09-08`: domain study §Stations, network
access (L455–487) and Track reuse (L561); trait catalog L56, L60; all 131 profiles
in `data/title-traits.json` for `construction-connectivity`, `station-placement`,
`station-blocking`, `network-types`, `additional-access-rights`,
`route-track-reuse`, `home-establishment` and `construction-usefulness`; variation
catalog rows for 1832, 1837, 1849, the gauge titles, 18SJ and 18Zoo.

- 111 titles reach from the company's stations by an ordinary route: no path,
  hex side or junction used twice, no stop visited twice, no reversal at a switch,
  a filled rival city and an offboard end a route. This includes 1817, 1830, 1832,
  1846, 1849, 1889 and 18Zoo.
- 13 titles use a purpose-specific graph: gauge filters (1840, 18Cuba, 18Ireland,
  18Norway, 1873, 18Carolinas; 1858 one gauge per lay), reach limited by train
  distance (1825, 1860), region graphs (1841), base-filtered starts (21Moon).
- Some reach ignores blocking or starts from a home without a station (1866
  nationals, 1873 mines, 1846 Little Miami).
- Some paths count only with a right (1832 coal B14, 1850 Mesabi, 1866 regions,
  1844 regionals and red hexes).
- 1837 lets station placement reverse at a switch. 18Zoo's holes pass routes
  through offboards.

## Decision

The shared search implements the ordinary rule exactly. A legal route uses no
path, stop or hex side twice, crosses every hex side it reaches, and does not pass
a blocked stop or an offboard. Routes are alternating paths in a graph of matched
vertex pairs for hex sides, stops and paths; one Edmonds blossom search from a
start joined to the stations labels everything a legal route reaches. No route is
enumerated, so the cost does not grow with switches or loops.

Title-owned choices stay where they were: the origins and blocking predicate of
`ConnectedTrack` (1846 Little Miami builds from its home without blocking),
`closedStop` from `stopAllowed` (1832 coal fields), and the construction rules in
`TrackRules`. Construction runs one search per company and board state and checks
each candidate tile within its hex, from the sides routes enter the hex by and
the company's stations on it. Track a route could reach only by leaving the hex
and coming back is not counted.

Not implemented, needing an option or hook when a title arrives: reversal at
switches for one purpose (1837), gauge separation, region borders, distance-limited
reach, starts other than stations, dropping paths without a right (`closedStop`
closes stops only), and passable offboards (18Zoo). Reversal and passable
offboards change the gadgets; distance limits need a different search.

## Verification

- `legalRoutes.spec.ts`: no leaving a stop the way a route came, no passing a stop
  twice to reach a switch's other branch, no hex side crossed twice, a full rival
  city and an offboard end a route, and replacement faces connect from a station
  on them and not through a full city.
- `games/the-old-prince/src/trackReach.spec.ts`: Souris does not reach Hunter River.
- Against an exhaustive route search on the reported TOP game and generated TOP
  boards up to 48 brown and 28 gray tiles, every company's entered sides, used
  paths, reached endpoints and blocked stops match; the search takes 2–3 ms for
  all companies on the densest board, where the exhaustive search takes 1 s.

Evidence gaps: TOP's connectivity rules are not in the research (TOP follows the
ordinary rule here); whether 18Zoo holes affect construction reach; and whether the
27 titles that forbid re-entering a hex in a run apply that to construction.

import { assertExists, type AxialCoordinates } from '@tabletop/common'

export enum Terrain {
    Plains = 'Plains',
    Hills = 'Hills',
    Mountains = 'Mountains'
}

export const TERRAIN_COST: Record<Terrain, number> = {
    [Terrain.Plains]: 2,
    [Terrain.Hills]: 3,
    [Terrain.Mountains]: 4
}

export enum SpaceKind {
    Rural = 'Rural',
    Approach = 'Approach',
    City = 'City'
}

export type City = {
    name: string
    value: number
}

export type MapSpace = {
    id: string
    kind: SpaceKind
    terrain: Terrain
    hexes: readonly AxialCoordinates[]
    city?: City
}

export const BERLIN = 'berlin'

const CITIES: Record<string, City> = {
    flensburg: { name: 'Flensburg', value: 1 },
    kiel: { name: 'Kiel', value: 1 },
    lubeck: { name: 'Lübeck', value: 1 },
    rostock: { name: 'Rostock', value: 1 },
    stralsund: { name: 'Stralsund', value: 1 },
    stolp: { name: 'Stolp', value: 1 },
    danzig: { name: 'Danzig', value: 1 },
    konigsberg: { name: 'Königsberg', value: 3 },
    hamburg: { name: 'Hamburg', value: 3 },
    neubrandenburg: { name: 'Neubrandenburg', value: 1 },
    stettin: { name: 'Stettin', value: 1 },
    oldenburg: { name: 'Oldenburg', value: 1 },
    bremen: { name: 'Bremen', value: 1 },
    wittenberge: { name: 'Wittenberge', value: 1 },
    schneidemuhl: { name: 'Schneidemühl', value: 1 },
    bromberg: { name: 'Bromberg', value: 1 },
    kreuz: { name: 'Kreuz', value: 1 },
    osnabruck: { name: 'Osnabrück', value: 1 },
    [BERLIN]: { name: 'Berlin', value: 3 },
    bielefeld: { name: 'Bielefeld', value: 1 },
    hannover: { name: 'Hannover', value: 1 },
    braunschweig: { name: 'Braunschweig', value: 1 },
    magdeburg: { name: 'Magdeburg', value: 1 },
    frankfurtOder: { name: 'Frankfurt an der Oder', value: 1 },
    posen: { name: 'Posen', value: 1 },
    wesel: { name: 'Wesel', value: 1 },
    munster: { name: 'Münster', value: 1 },
    hamm: { name: 'Hamm', value: 1 },
    kottbus: { name: 'Kottbus', value: 1 },
    duisburg: { name: 'Duisburg', value: 1 },
    essen: { name: 'Essen', value: 1 },
    dortmund: { name: 'Dortmund', value: 1 },
    gottingen: { name: 'Göttingen', value: 1 },
    halle: { name: 'Halle', value: 1 },
    liegnitz: { name: 'Liegnitz', value: 1 },
    dusseldorf: { name: 'Düsseldorf', value: 1 },
    kassel: { name: 'Kassel', value: 1 },
    muhlhausen: { name: 'Mühlhausen', value: 1 },
    erfurt: { name: 'Erfurt', value: 1 },
    leipzig: { name: 'Leipzig', value: 1 },
    dresden: { name: 'Dresden', value: 2 },
    gorlitz: { name: 'Görlitz', value: 1 },
    breslau: { name: 'Breslau', value: 2 },
    aachen: { name: 'Aachen', value: 1 },
    koln: { name: 'Köln', value: 2 },
    chemnitz: { name: 'Chemnitz', value: 1 },
    waldenburg: { name: 'Waldenburg', value: 1 },
    koblenz: { name: 'Koblenz', value: 1 },
    plauen: { name: 'Plauen', value: 1 },
    mainz: { name: 'Mainz', value: 1 },
    frankfurtMain: { name: 'Frankfurt am Main', value: 2 },
    wurzburg: { name: 'Würzburg', value: 1 },
    bamberg: { name: 'Bamberg', value: 1 },
    saarbrucken: { name: 'Saarbrücken', value: 1 },
    mannheim: { name: 'Mannheim', value: 1 },
    nurnberg: { name: 'Nürnberg', value: 1 },
    karlsruhe: { name: 'Karlsruhe', value: 1 },
    heilbronn: { name: 'Heilbronn', value: 1 },
    regensburg: { name: 'Regensburg', value: 1 },
    strasbourg: { name: 'Strasbourg', value: 1 },
    stuttgart: { name: 'Stuttgart', value: 1 },
    freiburg: { name: 'Freiburg im Breisgau', value: 1 },
    augsburg: { name: 'Augsburg', value: 1 },
    munchen: { name: 'München', value: 3 }
}

// Read from the Winsome printing's board, one string per printed row. A token is the doubled
// column, a terrain letter (p plains, h hills, m mountains, a Berlin Approach, b Berlin Urban
// Zone) and, for a city, `=` and its id.
const PRINTED_ROWS: readonly string[] = [
    '12p=flensburg 14p 34p 36p 38p 44p=konigsberg',
    '11p 13p 15p=kiel 21p 23p=stralsund 31p 33p=stolp 35p 37p 39p=danzig 41p 43p',
    '12p 14p 16p=lubeck 18p 20p=rostock 22p 24p 26p 28p 30p 32p 34p 36p 38p 40p 42p',
    '7p 11p 13p=hamburg 15p 17p 19p 21p 23p=neubrandenburg 25p 27p=stettin 29p 31p 33p 35p 37p 39p 41p',
    '6p 8p=oldenburg 10p=bremen 12p 14p 16p=wittenberge 18p 20p 22p 24p 26p 28p 30p 32p 34p=schneidemuhl 36p=bromberg 38p',
    '7p 9p 11p 13p 15p 17p 19p 21a 23a 25a 27p 29p 31p=kreuz 33p 35p 37p',
    '6p 8p=osnabruck 10p 12p 14p 16p 18p 20a 22b 24b 26a 28p 30p 32p 34p 36p',
    '5p 7p 9h=bielefeld 11h 13p=hannover 15p=braunschweig 17p 19p=magdeburg 21a 23b 25a 27p=frankfurtOder 29p 31p 33p=posen 35p',
    '4p=wesel 6p=munster 8p=hamm 10h 12h 14h 16p 18p 20p 22a 24a 26p=kottbus 28p 30p 32p 34p',
    '3p=duisburg 5p=essen 7p=dortmund 9h 11h 13h=gottingen 15m 17m 19p=halle 21p 23p 25p 27p 29p 31p=liegnitz 33p 35p',
    '4p=dusseldorf 6h 8h 10m 12m=kassel 14m=muhlhausen 16m=erfurt 18h 20p=leipzig 22h 24h=dresden 26h 28h=gorlitz 30h 32p 34p=breslau 36p',
    '3p=aachen 5h=koln 7h 9m 11m 13m 15m 17h 19h 21h 23h=chemnitz 25m 27m 29m 31m 33p=waldenburg 35p',
    '4h 6h=koblenz 8m 10h 12h 14h 16m 18h 20h=plauen 22m',
    '3h 5m 7h=mainz 9h=frankfurtMain 11m 13h=wurzburg 15h 17h=bamberg 19m 21m',
    '4m 6h 8h 10m 12h 14m 16m 18h 20m',
    '3m=saarbrucken 5m 7h 9h=mannheim 11h 13m 15m 17h=nurnberg 19m 21m',
    '4m 6h 8h=karlsruhe 10m=heilbronn 12m 14m 16h 18m 20h=regensburg 22m',
    '5h=strasbourg 7h 9m 11m=stuttgart 13m 15m 17h 19m 21h 23m',
    '6m=freiburg 8m 10m 12m 14m 16m=augsburg 18m=munchen 20m 22m'
]

const TERRAIN_LETTERS: Record<string, Terrain> = {
    p: Terrain.Plains,
    h: Terrain.Hills,
    m: Terrain.Mountains,
    a: Terrain.Plains,
    b: Terrain.Plains
}

export function printedHex(row: number, col: number): AxialCoordinates {
    return { q: (col - row) / 2, r: row }
}

export function hexKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}

function readSpaces(): MapSpace[] {
    const spaces: MapSpace[] = []
    const berlinHexes: AxialCoordinates[] = []
    PRINTED_ROWS.forEach((line, row) => {
        for (const token of line.split(' ')) {
            const match = /^(\d+)([phmab])(?:=(\w+))?$/.exec(token)
            assertExists(match, `Unreadable map token ${token}`)
            const [, col, letter, cityId] = match
            const coords = printedHex(row, Number(col))
            if (letter === 'b') {
                berlinHexes.push(coords)
                continue
            }
            const terrain = TERRAIN_LETTERS[letter]
            if (cityId) {
                const city = CITIES[cityId]
                assertExists(city, `Unknown city ${cityId}`)
                spaces.push({ id: cityId, kind: SpaceKind.City, terrain, hexes: [coords], city })
            } else {
                spaces.push({
                    id: `r${row}c${col}`,
                    kind: letter === 'a' ? SpaceKind.Approach : SpaceKind.Rural,
                    terrain,
                    hexes: [coords]
                })
            }
        }
    })
    spaces.push({
        id: BERLIN,
        kind: SpaceKind.City,
        terrain: Terrain.Plains,
        hexes: berlinHexes,
        city: CITIES[BERLIN]
    })
    return spaces
}

const NEIGHBOR_OFFSETS: readonly AxialCoordinates[] = [
    { q: 1, r: 0 },
    { q: -1, r: 0 },
    { q: 0, r: 1 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
    { q: -1, r: 1 }
]

export const MAP_SPACES: readonly MapSpace[] = readSpaces()

const SPACES_BY_ID = new Map(MAP_SPACES.map((space) => [space.id, space]))
const SPACE_ID_BY_HEX = new Map(
    MAP_SPACES.flatMap((space) => space.hexes.map((coords) => [hexKey(coords), space.id]))
)

const NEIGHBORS: ReadonlyMap<string, readonly string[]> = new Map(
    MAP_SPACES.map((space) => {
        const ids = new Set<string>()
        for (const coords of space.hexes) {
            for (const offset of NEIGHBOR_OFFSETS) {
                const neighbor = SPACE_ID_BY_HEX.get(
                    hexKey({ q: coords.q + offset.q, r: coords.r + offset.r })
                )
                if (neighbor !== undefined && neighbor !== space.id) {
                    ids.add(neighbor)
                }
            }
        }
        return [space.id, [...ids]]
    })
)

export function mapSpace(spaceId: string): MapSpace {
    const space = SPACES_BY_ID.get(spaceId)
    assertExists(space, `Unknown map space ${spaceId}`)
    return space
}

export function isMapSpace(spaceId: string): boolean {
    return SPACES_BY_ID.has(spaceId)
}

export function spaceIdAt(coords: AxialCoordinates): string | undefined {
    return SPACE_ID_BY_HEX.get(hexKey(coords))
}

export function neighboringSpaces(spaceId: string): readonly string[] {
    const neighbors = NEIGHBORS.get(spaceId)
    assertExists(neighbors, `Unknown map space ${spaceId}`)
    return neighbors
}

export function cityValue(spaceId: string): number {
    return mapSpace(spaceId).city?.value ?? 0
}

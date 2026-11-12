/**
 * The drawn forms of the pieces, as path data in a 24 unit box unless a shape says otherwise. One
 * source for the components and the cover script, so a piece looks the same everywhere. No colour
 * here: each caller paints with tokens or a seat colour.
 */

function gearPath(): string {
    const teeth = 8
    const points: string[] = []
    for (let tooth = 0; tooth < teeth; tooth += 1) {
        const angle = (tooth / teeth) * 2 * Math.PI
        for (const [offset, radius] of [
            [-0.3, 7.5],
            [-0.17, 10.5],
            [0.17, 10.5],
            [0.3, 7.5]
        ]) {
            const x = 12 + radius * Math.cos(angle + offset)
            const y = 12 + radius * Math.sin(angle + offset)
            points.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
        }
    }
    return `M${points.join(' L')} Z M12 8.5 A3.5 3.5 0 1 0 12 15.5 A3.5 3.5 0 1 0 12 8.5 Z`
}

/** The crown of a seal, a card back and the noble's icon. */
export const CrownPath = 'M3 19 L3 8 L8 13 L12 5 L16 13 L21 8 L21 19 Z'

/** The six characters' icons (R-4.5.1), told by shape on a medallion, a keep and a crest. */
export const GuildIconPaths = {
    farmer: 'M6 16 L6 20 L8 20 L8 17 L15 17 L15 20 L17 20 L17 16 A5 5 0 0 0 18 12 A3 3 0 0 0 21 9 A3 3 0 0 0 16 7 A5.5 5.5 0 0 0 7 8 A4.5 4.5 0 0 0 6 16 Z',
    merchant:
        'M2.5 8 A4.5 4.5 0 1 0 11.5 8 A4.5 4.5 0 1 0 2.5 8 Z M12.5 8 A4.5 4.5 0 1 0 21.5 8 A4.5 4.5 0 1 0 12.5 8 Z M7.5 17 A4.5 4.5 0 1 0 16.5 17 A4.5 4.5 0 1 0 7.5 17 Z',
    alchemist: gearPath(),
    knight: 'M11 2 L13 2 L13 22 L11 22 Z M13 5 C18 3 21 6 21 10 C21 14 18 15 13 13 Z M11 5 C6 3 3 6 3 10 C3 14 6 15 11 13 Z',
    noble: CrownPath,
    monk: 'M10.5 2 L13.5 2 L13.5 8 L19 8 L19 11 L13.5 11 L13.5 22 L10.5 22 L10.5 11 L5 11 L5 8 L10.5 8 Z'
} as const

/** Each good's silhouette, so none is told by its colour alone. */
export const GoodPaths = {
    saltpeter: 'M12 2 L19 8 L17 20 L7 20 L5 8 Z',
    sulfur: 'M5 16 C2 11 6 6 10 7 C12 3 18 4 19 9 C23 12 20 19 15 19 C12 21 7 20 5 16 Z',
    iron: 'M6 7 L18 7 L22 18 L2 18 Z',
    wood: 'M4 8 L18 8 A3 5 0 0 1 18 18 L4 18 A3 5 0 0 1 4 8 Z',
    food: 'M11 21 L11 12 C7 11 5 7 6 3 C9 4 11 6 12 9 C13 6 15 4 18 3 C19 7 17 11 13 12 L13 21 Z'
} as const

/**
 * A pawn as the wooden cube it is, in a 32 unit square seen a little from above: the top face, the
 * front side below it, and where its character is printed on top, in the guild icons' 24 unit box.
 */
export const PawnCube = {
    box: 32,
    side: { x: 1, y: 4, width: 30, height: 27 },
    top: { x: 1, y: 1, width: 30, height: 24 },
    shine: { x: 2.5, y: 2.2, width: 27, height: 5 },
    corner: 3.5,
    face: { x: 6, y: 3, size: 20 }
} as const

/** Vessels, in a 48 x 32 box: hull and the part that names its medium. */
export const VesselPaths = {
    ship: {
        hull: 'M4 20 L44 20 L38 29 L10 29 Z',
        part: 'M23 3 L25 3 L25 19 L23 19 Z M26 5 L38 17 L26 17 Z M22 7 L12 17 L22 17 Z'
    },
    submersible: {
        hull: 'M6 20 A18 8 0 0 1 42 20 A18 8 0 0 1 6 20 Z',
        part: 'M22 4 L32 4 L32 7 L25 7 L25 13 L22 13 Z'
    },
    'flying-machine': {
        hull: 'M14 24 L34 24 L31 30 L17 30 Z',
        part: 'M24 2 A12 10 0 0 1 36 12 C36 16 31 19 29 22 L19 22 C17 19 12 16 12 12 A12 10 0 0 1 24 2 Z M36 21 L47 16 L44 25 Z M12 21 L1 16 L4 25 Z'
    }
} as const

/** Monsters, in a 48 x 48 box: own silhouettes, with the band a controlled one wears. */
export const MonsterPaths = {
    behemoth: {
        body: 'M24 2 L26 8 C33 8 37 14 37 22 C41 26 41 32 38 34 L37 44 L29 44 L28 38 L20 38 L19 44 L11 44 L10 34 C7 32 7 26 11 22 C11 14 15 8 22 8 Z',
        collar: 'M14 17 L34 17 L35 21 L13 21 Z'
    },
    'sea-serpent': {
        body: 'M4 10 L14 6 L18 9 C24 9 25 15 21 18 C17 21 15 23 19 25 C25 27 31 21 37 25 C43 29 42 38 34 39 C39 35 37 30 32 30 C27 30 22 35 16 32 C9 29 9 22 14 18 C17 16 16 13 13 13 L5 14 Z',
        collar: 'M16 8 L20 10 L18 15 L14 13 Z'
    }
} as const

/** A keep on its hill, in a 100 x 100 box, for the feudum's fallback and the cover. */
export const KeepPath =
    'M28 92 L28 44 L22 44 L22 30 L30 30 L30 36 L38 36 L38 30 L46 30 L46 36 L54 36 L54 30 L62 30 L62 36 L70 36 L70 30 L78 30 L78 44 L72 44 L72 92 L58 92 L58 72 A8 8 0 0 0 42 72 L42 92 Z'

export const LocationPaths = {
    outpost:
        'M8 21 L8 9 L5 9 L5 3 L8 3 L8 5 L11 5 L11 3 L13 3 L13 5 L16 5 L16 3 L19 3 L19 9 L16 9 L16 21 Z',
    farm: 'M3 17 L21 17 L21 21 L3 21 Z M3 12 L21 12 L21 15 L3 15 Z M3 7 L21 7 L21 10 L3 10 Z M6 3 L18 3 L18 5 L6 5 Z',
    town: 'M2 21 L2 11 L7 5 L12 11 L17 5 L22 11 L22 21 Z'
} as const

/** What a landscape tile shows when turned (R-4.3), each told by shape. */
export const LandscapePaths = {
    orchard:
        'M11 21 L11 14 C7 15 3 13 3 9 C3 5 7 2 12 2 C17 2 21 5 21 9 C21 13 17 15 13 14 L13 21 Z',
    'silver-mine': 'M3 21 L12 4 L21 21 L16 21 L12 13 L8 21 Z M3 5 L8 3 L15 9 L13 11 L6 6 Z',
    'archery-butt':
        'M12 2 A10 10 0 1 0 12 22 A10 10 0 1 0 12 2 Z M12 6 A6 6 0 1 1 12 18 A6 6 0 1 1 12 6 Z M12 9.5 A2.5 2.5 0 1 0 12 14.5 A2.5 2.5 0 1 0 12 9.5 Z',
    'sulfur-mine': 'M12 2 C15 7 19 11 19 15 A7 7 0 0 1 5 15 C5 11 9 7 12 2 Z'
} as const

/** The drop a drunk pawn carries. */
export const DropPath = LandscapePaths['sulfur-mine']

/** A five-pointed star in the 24 unit box, with no font behind it. */
export const StarPath = 'M12 2 L15 9 L22 9.5 L16.5 14 L18.5 21 L12 17 L5.5 21 L7.5 14 L2 9.5 L9 9 Z'

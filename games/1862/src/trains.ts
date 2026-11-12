import { PhaseTable, TrainDepot, type TrainDefinition } from '@tabletop/18xx'

/** The three ways a train card can run, chosen as it is bought (§2.2). */
export const TrainKinds = ['express', 'local', 'freight'] as const
export type TrainKind = (typeof TrainKinds)[number]

export const Bands = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
export type Band = (typeof Bands)[number]

type BandFaces = {
    price: number
    /** Express and Local: large stations paid, and visited where more (an N/M train). */
    stops: readonly [paid: number, visited: number]
    freight: number
    rustsOn?: Band
}

// The train table (§9): each card's faces, cost and the band whose first train retires it.
const BandFaces: Readonly<Record<Band, BandFaces>> = {
    A: { price: 100, stops: [2, 2], freight: 1, rustsOn: 'C' },
    B: { price: 200, stops: [2, 3], freight: 2, rustsOn: 'E' },
    C: { price: 280, stops: [3, 3], freight: 3, rustsOn: 'F' },
    D: { price: 360, stops: [4, 4], freight: 5, rustsOn: 'G' },
    E: { price: 500, stops: [4, 5], freight: 6 },
    F: { price: 600, stops: [5, 5], freight: 7 },
    G: { price: 700, stops: [5, 6], freight: 8 },
    H: { price: 800, stops: [6, 6], freight: 9 }
}

const KindLetter: Readonly<Record<TrainKind, string>> = { express: 'E', local: 'L', freight: 'F' }

export function trainDefinitionId(band: Band, kind: TrainKind): string {
    return `${band}${KindLetter[kind]}`
}

function stopsName([paid, visited]: readonly [number, number]): string {
    return paid === visited ? `${paid}` : `${paid}/${visited}`
}

function face(band: Band, kind: TrainKind): TrainDefinition {
    const { price, stops, freight, rustsOn } = BandFaces[band]
    return {
        id: trainDefinitionId(band, kind),
        name: kind === 'freight' ? `${freight}F` : `${stopsName(stops)}${KindLetter[kind]}`,
        price,
        distance:
            kind === 'freight'
                ? { measure: 'hex-edges', maximum: freight }
                : { measure: 'cities-and-offboards', maximum: stops[1] },
        ...(rustsOn ? { rustsOn: trainDefinitionId(rustsOn, 'express') } : {})
    }
}

/** The kind and band of a train face. */
export function trainFace(definitionId: string): { band: Band; kind: TrainKind } {
    const band = Bands.find((band) => band === definitionId[0])
    const kind = TrainKinds.find((kind) => KindLetter[kind] === definitionId[1])
    if (!band || !kind || definitionId.length !== 2)
        throw new Error(`Unknown train ${definitionId}`)
    return { band, kind }
}

/** The large stations an Express or Local train is paid for (§7.8.2–3); Freight has none. */
export function paidStops(definitionId: string): number | undefined {
    const { band, kind } = trainFace(definitionId)
    return kind === 'freight' ? undefined : BandFaces[band].stops[0]
}

/** Freight trains of bands E–H are permanent and may run apart from the others (§7.8.1). */
export function permanentFreight(definitionId: string): boolean {
    const { band, kind } = trainFace(definitionId)
    return kind === 'freight' && !BandFaces[band].rustsOn
}

export function bandPrice(band: Band): number {
    return BandFaces[band].price
}

export function bandRustsOn(band: Band): Band | undefined {
    return BandFaces[band].rustsOn
}

export const GameLengths = ['short', 'standard', 'long'] as const
export type GameLength = (typeof GameLengths)[number]

// The trains of each band for a game's length (§2.4.3, §9); H is unlimited.
const BandCounts: Readonly<Record<GameLength, Readonly<Record<Exclude<Band, 'H'>, number>>>> = {
    short: { A: 6, B: 5, C: 4, D: 3, E: 3, F: 2, G: 1 },
    standard: { A: 7, B: 6, C: 4, D: 3, E: 3, F: 2, G: 1 },
    long: { A: 7, B: 6, C: 5, D: 4, E: 3, F: 2, G: 1 }
}

export const StandardDepotId = '1862'
export const depotIdFor = (length: GameLength) =>
    length === 'standard' ? StandardDepotId : `1862-${length}`

export const TrainDepot1862 = new TrainDepot({
    id: StandardDepotId,
    trains: Bands.flatMap((band) => TrainKinds.map((kind) => face(band, kind))),
    supply: Bands.map((band) => ({
        definitionId: trainDefinitionId(band, 'express'),
        variantDefinitionIds: [
            trainDefinitionId(band, 'local'),
            trainDefinitionId(band, 'freight')
        ],
        count: band === 'H' ? ('unlimited' as const) : BandCounts.standard[band]
    })),
    supplyVariants: Object.fromEntries(
        (['short', 'long'] as const).map((length) => [
            depotIdFor(length),
            Object.fromEntries(
                Bands.flatMap((band) =>
                    band === 'H'
                        ? []
                        : [[trainDefinitionId(band, 'express'), BandCounts[length][band]]]
                )
            )
        ])
    )
})

const yellow = ['yellow']
const green = ['yellow', 'green']
const brown = ['yellow', 'green', 'brown']
const startedBy = (band: Band) => TrainKinds.map((kind) => trainDefinitionId(band, kind))

/**
 * The phases, named by band, each started by its band's first train (§9). The family's single
 * train limit is not 1862's: limits by kind are the title's, and excess trains are kept.
 */
export const Phases1862 = new PhaseTable(
    [
        { id: 'A', startedBy: [], tileColors: yellow, operatingRounds: 1, trainLimit: 9 },
        {
            id: 'B',
            startedBy: startedBy('B'),
            tileColors: green,
            operatingRounds: 2,
            trainLimit: 9
        },
        {
            id: 'C',
            startedBy: startedBy('C'),
            tileColors: green,
            operatingRounds: 2,
            trainLimit: 9
        },
        {
            id: 'D',
            startedBy: startedBy('D'),
            tileColors: brown,
            operatingRounds: 3,
            trainLimit: 9
        },
        {
            id: 'E',
            startedBy: startedBy('E'),
            tileColors: brown,
            operatingRounds: 3,
            trainLimit: 9
        },
        {
            id: 'F',
            startedBy: startedBy('F'),
            tileColors: brown,
            operatingRounds: 3,
            trainLimit: 9
        },
        {
            id: 'G',
            startedBy: startedBy('G'),
            tileColors: brown,
            operatingRounds: 3,
            trainLimit: 9
        },
        { id: 'H', startedBy: startedBy('H'), tileColors: brown, operatingRounds: 3, trainLimit: 9 }
    ],
    TrainDepot1862
)

/** Trains a company may hold of each kind, or in all, before buying another (§7.9). */
export function kindLimit(phaseId: string): { perKind: number } | { total: number } {
    if (Phases1862.isAtLeast(phaseId, 'G')) return { total: 3 }
    if (Phases1862.isAtLeast(phaseId, 'E')) return { perKind: 2 }
    return { perKind: 3 }
}

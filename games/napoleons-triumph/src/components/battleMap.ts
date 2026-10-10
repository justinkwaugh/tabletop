import { assert, assertExists } from '@tabletop/common'
import { Side, UnitType } from './pieces.js'

export type LocaleId = number
export type ApproachId = number

export enum Star {
    Blue = 'Blue',
    Red = 'Red',
    Green = 'Green',
    Black = 'Black'
}

export interface ApproachDefinition {
    id: ApproachId
    locale: LocaleId
    opposite: ApproachId
    neighbour: LocaleId
    wide: boolean
    impassable: boolean
    obstructed: boolean
    /** Unit types penalised when attacking into this approach's locale across it. */
    penalties: UnitType[]
}

export interface RoadEntry {
    id: string
    side: Side
    locale: LocaleId
    /** Index of the connected stretch of road, within its locale, that the entry leads onto. */
    group: number
    main: boolean
}

/** One direction of a road crossing an approach, from one connected stretch of road to another. */
export interface RoadLink {
    exit: ApproachId
    from: LocaleId
    fromGroup: number
    to: LocaleId
    toGroup: number
    main: boolean
}

export interface LocaleDefinition {
    id: LocaleId
    name?: string
    capacity: number
    hill: boolean
    stars: Star[]
    setupCommanderId?: string
    approaches: ApproachId[]
}

export interface LocaleSpec {
    id: LocaleId
    capacity: number
    name?: string
    hill?: true
    stars?: Star[]
    setup?: string
}

/** Penalty letters: I infantry, C cavalry, A artillery, O obstructed. */
export interface BorderSpec {
    a: LocaleId
    b: LocaleId
    wide?: true
    impassable?: true
    aSymbols?: string
    bSymbols?: string
}

/** A road crossing the border between two locales, joining one road group on each side. */
export type RoadSpec = [a: LocaleId, groupA: number, b: LocaleId, groupB: number, main: 0 | 1]
export type EntrySpec = [id: string, side: Side, locale: LocaleId, group: number, main: 0 | 1]

export interface MapSpec {
    locales: LocaleSpec[]
    borders: BorderSpec[]
    roads: RoadSpec[]
    entries: EntrySpec[]
}

export const MAIN_ROAD_REACH = 3
export const LOCAL_ROAD_REACH = 2

const PENALTY_LETTERS: Record<string, UnitType> = {
    I: UnitType.Infantry,
    C: UnitType.Cavalry,
    A: UnitType.Artillery
}

/** Where a road move can stand after following its path: on which road, and whether all of it was main road. */
export interface RoadArrival {
    locale: LocaleId
    group: number
    main: boolean
}

export class BattleMap {
    private readonly locales = new Map<LocaleId, LocaleDefinition>()
    private readonly approaches = new Map<ApproachId, ApproachDefinition>()
    private readonly roadLinks: RoadLink[] = []
    private readonly roadEntries: RoadEntry[] = []

    constructor(spec: MapSpec) {
        for (const locale of spec.locales) {
            assert(!this.locales.has(locale.id), `Duplicate locale ${locale.id}`)
            this.locales.set(locale.id, {
                id: locale.id,
                name: locale.name,
                capacity: locale.capacity,
                hill: locale.hill === true,
                stars: locale.stars ?? [],
                setupCommanderId: locale.setup,
                approaches: []
            })
        }
        spec.borders.forEach((border, index) => {
            this.addApproach(index * 2, border.a, border.b, border, border.aSymbols ?? '')
            this.addApproach(index * 2 + 1, border.b, border.a, border, border.bSymbols ?? '')
        })
        for (const [a, groupA, b, groupB, main] of spec.roads) {
            this.roadLinks.push(
                this.roadLink(a, groupA, b, groupB, main === 1),
                this.roadLink(b, groupB, a, groupA, main === 1)
            )
        }
        for (const [id, side, locale, group, main] of spec.entries) {
            this.roadEntries.push({ id, side, locale: this.locale(locale).id, group, main: main === 1 })
        }
    }

    private roadLink(
        from: LocaleId,
        fromGroup: number,
        to: LocaleId,
        toGroup: number,
        main: boolean
    ): RoadLink {
        return { exit: this.approachBetween(from, to).id, from, fromGroup, to, toGroup, main }
    }

    private addApproach(
        id: ApproachId,
        locale: LocaleId,
        neighbour: LocaleId,
        border: BorderSpec,
        symbols: string
    ) {
        this.approaches.set(id, {
            id,
            locale,
            neighbour,
            opposite: id % 2 === 0 ? id + 1 : id - 1,
            wide: border.wide === true,
            impassable: border.impassable === true,
            obstructed: symbols.includes('O'),
            penalties: [...symbols].flatMap((letter) => PENALTY_LETTERS[letter] ?? [])
        })
        this.locale(locale).approaches.push(id)
    }

    get localeIds(): LocaleId[] {
        return [...this.locales.keys()]
    }

    get allLocales(): LocaleDefinition[] {
        return [...this.locales.values()]
    }

    get allApproaches(): ApproachDefinition[] {
        return [...this.approaches.values()]
    }

    locale(id: LocaleId): LocaleDefinition {
        const locale = this.locales.get(id)
        assertExists(locale, `Unknown locale ${id}`)
        return locale
    }

    hasLocale(id: LocaleId): boolean {
        return this.locales.has(id)
    }

    approach(id: ApproachId): ApproachDefinition {
        const approach = this.approaches.get(id)
        assertExists(approach, `Unknown approach ${id}`)
        return approach
    }

    hasApproach(id: ApproachId): boolean {
        return this.approaches.has(id)
    }

    opposite(id: ApproachId): ApproachDefinition {
        return this.approach(this.approach(id).opposite)
    }

    approachesOf(locale: LocaleId): ApproachDefinition[] {
        return this.locale(locale).approaches.map((id) => this.approach(id))
    }

    passableApproachesOf(locale: LocaleId): ApproachDefinition[] {
        return this.approachesOf(locale).filter((approach) => !approach.impassable)
    }

    findApproachBetween(from: LocaleId, to: LocaleId): ApproachDefinition | undefined {
        return this.approachesOf(from).find((approach) => approach.neighbour === to)
    }

    /** The side of the shared border that lies in `from`. */
    approachBetween(from: LocaleId, to: LocaleId): ApproachDefinition {
        const approach = this.findApproachBetween(from, to)
        assertExists(approach, `Locales ${from} and ${to} do not share an approach`)
        return approach
    }

    /** Locales on the other side of any approach, passable or not (rule 4). */
    adjacentLocales(locale: LocaleId): LocaleId[] {
        return this.approachesOf(locale).map((approach) => approach.neighbour)
    }

    reachableNeighbours(locale: LocaleId): LocaleId[] {
        return this.passableApproachesOf(locale).map((approach) => approach.neighbour)
    }

    /** Fewest locales between two locales without crossing an impassable approach. */
    distance(from: LocaleId, to: LocaleId): number | undefined {
        const distances = new Map<LocaleId, number>([[from, 0]])
        const queue = [from]
        for (const current of queue) {
            const steps = distances.get(current) ?? 0
            if (current === to) {
                return steps
            }
            for (const next of this.reachableNeighbours(current)) {
                if (!distances.has(next)) {
                    distances.set(next, steps + 1)
                    queue.push(next)
                }
            }
        }
        return undefined
    }

    localesWithStar(star: Star): LocaleDefinition[] {
        return this.allLocales.filter((locale) => locale.stars.includes(star))
    }

    setupLocale(commanderId: string): LocaleDefinition | undefined {
        return this.allLocales.find((locale) => locale.setupCommanderId === commanderId)
    }

    roadLinksFrom(locale: LocaleId): RoadLink[] {
        return this.roadLinks.filter((link) => link.from === locale)
    }

    /** Roads leaving a locale across one of its approaches. */
    roadLinksAcross(approachId: ApproachId): RoadLink[] {
        return this.roadLinks.filter((link) => link.exit === approachId)
    }

    entries(side: Side): RoadEntry[] {
        return this.roadEntries.filter((entry) => entry.side === side)
    }

    findEntry(entryId: string): RoadEntry | undefined {
        return this.roadEntries.find((entry) => entry.id === entryId)
    }

    entryLocales(side: Side): LocaleId[] {
        return [...new Set(this.entries(side).map((entry) => entry.locale))]
    }

    /**
     * Follows a road move locale by locale. `path` lists the locales entered in order. A move on
     * the map starts in `start` on any of its roads; a reinforcement names its entry instead and
     * the first path locale is the entry locale. Returns every road the move could be standing on
     * at the end, or nothing when no connected road covers the path within its reach.
     */
    traceRoad(start: LocaleId | { entryId: string }, path: LocaleId[]): RoadArrival[] {
        let arrivals: RoadArrival[]
        let remaining = path
        let anyRoad = false
        if (typeof start === 'number') {
            arrivals = [{ locale: start, group: -1, main: true }]
            anyRoad = true
        } else {
            const entry = this.findEntry(start.entryId)
            if (!entry || path[0] !== entry.locale) {
                return []
            }
            arrivals = [{ locale: entry.locale, group: entry.group, main: entry.main }]
            remaining = path.slice(1)
        }
        for (const next of remaining) {
            const stepped: RoadArrival[] = []
            for (const arrival of arrivals) {
                for (const link of this.roadLinksFrom(arrival.locale)) {
                    if (link.to !== next || (!anyRoad && link.fromGroup !== arrival.group)) {
                        continue
                    }
                    const main = arrival.main && link.main
                    if (!stepped.some((other) => other.group === link.toGroup && other.main === main)) {
                        stepped.push({ locale: next, group: link.toGroup, main })
                    }
                }
            }
            arrivals = stepped
            anyRoad = false
        }
        return arrivals.filter(
            (arrival) => path.length <= (arrival.main ? MAIN_ROAD_REACH : LOCAL_ROAD_REACH)
        )
    }

    /** Approaches of the arrival locale crossed by the road the move arrived on. */
    approachesOnRoad(arrivals: RoadArrival[]): ApproachId[] {
        const approaches = arrivals.flatMap((arrival) =>
            this.roadLinksFrom(arrival.locale)
                .filter((link) => arrival.group === -1 || link.fromGroup === arrival.group)
                .map((link) => link.exit)
        )
        return [...new Set(approaches)]
    }

    /** Whether a road path joins two locales, optionally avoiding some locales (rule 16). */
    roadConnects(from: LocaleId, to: LocaleId, blocked: (locale: LocaleId) => boolean): boolean {
        const seen = new Set<string>()
        const queue: { locale: LocaleId; group: number }[] = [{ locale: from, group: -1 }]
        for (const current of queue) {
            if (current.locale === to) {
                return true
            }
            for (const link of this.roadLinksFrom(current.locale)) {
                if (current.group !== -1 && link.fromGroup !== current.group) {
                    continue
                }
                const key = `${link.to}:${link.toGroup}`
                if (seen.has(key) || blocked(link.to)) {
                    continue
                }
                seen.add(key)
                queue.push({ locale: link.to, group: link.toGroup })
            }
        }
        return false
    }
}

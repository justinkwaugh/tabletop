import { assertExists, type BoundingBox, type Point } from '@tabletop/common'
import { MapId, sarMap, type RailroadId } from '@tabletop/texas-special'
import { FRONTIER_LAYOUT } from './maps/frontier.js'
import { KEYSTONE_LAYOUT } from './maps/keystone.js'
import { OLD_FRONTIER_LAYOUT } from './maps/oldFrontier.js'
import { SOUTH_AFRICA_LAYOUT } from './maps/southAfrica.js'
import { TEXAS_SPECIAL_LAYOUT } from './maps/texasSpecial.js'

export const LINK_BOX_SIZE = 28
export const METRO_CELL = 27

export type MapLabel = Point & { rotate?: number }
export type BaseName = Point & { railroadId: RailroadId }
export type MetroGrid = { columns: number; origin: Point }
export type RegionLabel = Point & { lines: string[]; rotate?: number }
// A border whose links stay closed until a dividend, drawn along its printed course.
export type ClosedBorderLine = {
    opensAfterDividend: number
    points: readonly Point[]
    // The centre of its caption, which may run along the border.
    label: MapLabel
}
// Short reminders of where a map's rules differ from Frontier Railroads, each note pre-wrapped.
export type RulesReminder = Point & { width: number; notes: readonly (readonly string[])[] }

export type BoardLayoutSpec = {
    width: number
    // The printed board's rows above the play area are cropped away; the map keeps the printed
    // coordinates.
    top: number
    bottom: number
    legend: Point
    finalPayoff: Point
    // The centre of the title's baseline.
    logo: Point
    title: string
    credit: string
    // Where the map's special connection, if it has one, is explained.
    specialConnection?: Point
    // Where the order of Automatic Metro Development is printed, when there is more than one.
    automaticDevelopment?: Point
    rulesReminder?: RulesReminder
    closedBorders?: readonly ClosedBorderLine[]
    metroGrids: Readonly<Record<string, MetroGrid>>
    baseNames: readonly BaseName[]
    // When present, the only settlements named on the board; otherwise every one but the natural
    // resources is.
    namedSettlements?: readonly string[]
    // Where the printed board sets each settlement name: the start of its baseline.
    printedLabels: Readonly<Record<string, MapLabel>>
    regions: readonly RegionLabel[]
}

export const LEGEND_SIZE = { width: 226, height: 162 }
export const FINAL_PAYOFF_SIZE = { width: 300, height: 112 }
export const LOGO_SIZE = { width: 360, height: 62 }
export const SPECIAL_CONNECTION_SIZE = { width: 300, height: 132 }
// The order is a numbered list below the heading, with a short note under it.
export const AUTOMATIC_DEVELOPMENT_WIDTH = 250
export const AUTOMATIC_DEVELOPMENT_HEADING = 40
export const AUTOMATIC_DEVELOPMENT_ROW = 18
export const AUTOMATIC_DEVELOPMENT_NOTE_LINE = 14

export function automaticDevelopmentNote(freeMetroDevelopment: boolean): string[] {
    return freeMetroDevelopment
        ? ['the first not full is free, and', 'develops if a 2nd is declined']
        : ['once one is full, the next']
}
export const RULES_REMINDER_LINE = 16
export const RULES_REMINDER_NOTE_GAP = 6
export const RULES_REMINDER_HEADING = 52

export class BoardLayout {
    readonly width: number
    readonly top: number
    readonly height: number

    constructor(
        readonly mapId: MapId,
        readonly spec: BoardLayoutSpec
    ) {
        this.width = spec.width
        this.top = spec.top
        this.height = spec.bottom - spec.top
    }

    get legend(): BoundingBox {
        return { x: this.spec.legend.x - 2, y: this.spec.legend.y - 2, ...LEGEND_SIZE }
    }

    get finalPayoff(): BoundingBox {
        return { ...this.spec.finalPayoff, ...FINAL_PAYOFF_SIZE }
    }

    get logo(): BoundingBox {
        return {
            x: this.spec.logo.x - LOGO_SIZE.width / 2,
            y: this.spec.logo.y - 30,
            ...LOGO_SIZE
        }
    }

    get specialConnection(): BoundingBox | undefined {
        const origin = this.spec.specialConnection
        return origin ? { ...origin, ...SPECIAL_CONNECTION_SIZE } : undefined
    }

    get automaticDevelopment(): BoundingBox | undefined {
        const note = this.spec.automaticDevelopment
        if (!note) {
            return undefined
        }
        const definition = sarMap(this.mapId).definition
        return {
            x: note.x,
            y: note.y,
            width: AUTOMATIC_DEVELOPMENT_WIDTH,
            height:
                AUTOMATIC_DEVELOPMENT_HEADING +
                definition.automaticDevelopment.length * AUTOMATIC_DEVELOPMENT_ROW +
                automaticDevelopmentNote(definition.freeMetroDevelopment).length *
                    AUTOMATIC_DEVELOPMENT_NOTE_LINE
        }
    }

    get rulesReminder(): BoundingBox | undefined {
        const reminder = this.spec.rulesReminder
        if (!reminder) {
            return undefined
        }
        const lines = reminder.notes.reduce((sum, note) => sum + note.length, 0)
        return {
            x: reminder.x,
            y: reminder.y,
            width: reminder.width,
            height:
                RULES_REMINDER_HEADING +
                lines * RULES_REMINDER_LINE +
                reminder.notes.length * RULES_REMINDER_NOTE_GAP
        }
    }

    // Printed furniture the settlement names must stay off.
    get furniture(): BoundingBox[] {
        return [
            this.legend,
            this.finalPayoff,
            this.logo,
            ...(this.specialConnection ? [this.specialConnection] : []),
            ...(this.automaticDevelopment ? [this.automaticDevelopment] : []),
            ...(this.rulesReminder ? [this.rulesReminder] : [])
        ]
    }

    metroGrid(settlementId: string): MetroGrid {
        const grid = this.spec.metroGrids[settlementId]
        assertExists(grid, `No development grid for ${settlementId}`)
        return grid
    }
}

const BOARD_LAYOUTS: Record<MapId, BoardLayout> = {
    [MapId.SouthAfrica]: new BoardLayout(MapId.SouthAfrica, SOUTH_AFRICA_LAYOUT),
    [MapId.TexasSpecial]: new BoardLayout(MapId.TexasSpecial, TEXAS_SPECIAL_LAYOUT),
    [MapId.Frontier]: new BoardLayout(MapId.Frontier, FRONTIER_LAYOUT),
    [MapId.Keystone]: new BoardLayout(MapId.Keystone, KEYSTONE_LAYOUT),
    [MapId.OldFrontier]: new BoardLayout(MapId.OldFrontier, OLD_FRONTIER_LAYOUT)
}

export function boardLayout(mapId: MapId): BoardLayout {
    return BOARD_LAYOUTS[mapId]
}

import type { AxialCoordinates, GameAction } from '@tabletop/common'
import {
    BOARD_GRID,
    villagePlaceId,
    type HydratedBoard,
    isBuildMarket,
    isEndTurn,
    isPlaceCity,
    isPlaceRoad,
    isResupply,
    isSellMarket,
    type OracleChange
} from '@tabletop/magna-grecia'

export type HistoryTurn = {
    key: string
    playerId: string
    round: number
    actions: GameAction[]
    ended: boolean
    lastAt?: Date
}

export type HistoryRound = {
    round: number
    turns: HistoryTurn[]
}

export type HistoryEntryKind = 'road' | 'city' | 'market' | 'sold-market' | 'resupply'

export type HistoryEntry = {
    kind: HistoryEntryKind
    label: string
    detail?: string
    points?: number
    foundingMarket: boolean
    oracleChanges: OracleChange[]
}

// Every player takes exactly one turn per round, so ended turns count off the rounds.
export function historyRounds(actions: GameAction[], playerCount: number): HistoryRound[] {
    const rounds: HistoryRound[] = []
    let endedTurns = 0
    let turn: HistoryTurn | undefined

    for (const action of actions) {
        if (!action.playerId) {
            continue
        }
        if (!turn) {
            const round = Math.floor(endedTurns / playerCount)
            turn = {
                key: action.id,
                playerId: action.playerId,
                round,
                actions: [],
                ended: false
            }
            if (rounds.at(-1)?.round !== round) {
                rounds.push({ round, turns: [] })
            }
            rounds.at(-1)!.turns.push(turn)
        }
        turn.lastAt = action.createdAt ?? turn.lastAt
        if (isEndTurn(action)) {
            turn.ended = true
            turn = undefined
            endedTurns += 1
        } else {
            turn.actions.push(action)
        }
    }
    return rounds
}

export function plural(count: number, noun: string, nouns = `${noun}s`): string {
    return `${count} ${count === 1 ? noun : nouns}`
}

export function resupplyText(roads: number, cities: number): string {
    const parts = [
        roads > 0 ? plural(roads, 'road') : undefined,
        cities > 0 ? plural(cities, 'city tile', 'city tiles') : undefined
    ].filter((part) => part !== undefined)
    return parts.length > 0 ? parts.join(' and ') : 'nothing'
}

export function historyEntry(action: GameAction): HistoryEntry | undefined {
    if (isPlaceRoad(action)) {
        return {
            kind: 'road',
            label: 'Built a road',
            foundingMarket: false,
            oracleChanges: action.metadata?.oracleChanges ?? []
        }
    }
    if (isPlaceCity(action)) {
        const metadata = action.metadata
        const joined = metadata?.mergedCityIds.length ?? 0
        return {
            kind: 'city',
            label: metadata?.founded
                ? 'Founded a city'
                : joined > 0
                  ? `Joined ${joined + 1} cities`
                  : 'Expanded a city',
            detail: metadata?.claimVillage ? 'beside a village' : undefined,
            points: -1,
            foundingMarket: metadata?.foundingMarket ?? false,
            oracleChanges: metadata?.oracleChanges ?? []
        }
    }
    if (isResupply(action)) {
        return {
            kind: 'resupply',
            label: 'Resupplied',
            detail: resupplyText(action.roads, action.cities),
            foundingMarket: false,
            oracleChanges: []
        }
    }
    if (isBuildMarket(action)) {
        return {
            kind: 'market',
            label: 'Built a market',
            points: action.metadata ? -action.metadata.cost : undefined,
            foundingMarket: false,
            oracleChanges: []
        }
    }
    if (isSellMarket(action)) {
        return {
            kind: 'sold-market',
            label: 'Sold a market',
            points: action.metadata?.value,
            foundingMarket: false,
            oracleChanges: []
        }
    }
    return undefined
}

export type HistoryLine = {
    key: string
    actions: GameAction[]
    entry: HistoryEntry
}

// Roads laid one after another read as one line, so a long build stays a glance.
export function historyLines(actions: GameAction[]): HistoryLine[] {
    const lines: HistoryLine[] = []
    for (const action of actions) {
        const entry = historyEntry(action)
        if (!entry) {
            continue
        }
        const previous = lines.at(-1)
        if (previous && entry.kind === 'road' && previous.entry.kind === 'road') {
            previous.actions.push(action)
            previous.entry = {
                ...previous.entry,
                label: `Built ${previous.actions.length} roads`,
                oracleChanges: [...previous.entry.oracleChanges, ...entry.oracleChanges]
            }
            continue
        }
        lines.push({ key: action.id, actions: [action], entry })
    }
    return lines
}

export function historySpaces(actions: GameAction[], board: HydratedBoard): AxialCoordinates[] {
    return actions.flatMap((action) => {
        if (isPlaceRoad(action) || isPlaceCity(action) || isSellMarket(action)) {
            return [action.coords]
        }
        if (isBuildMarket(action)) {
            const village = BOARD_GRID.villages().find(
                (space) => villagePlaceId(space.coords) === action.placeId
            )
            return village ? [village.coords] : (board.place(action.placeId)?.spaces ?? [])
        }
        return []
    })
}

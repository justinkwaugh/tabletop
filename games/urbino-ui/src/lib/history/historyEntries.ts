import type { GameAction } from '@tabletop/common'
import {
    isChooseFirstPlayer,
    isConcede,
    isPass,
    isPlaceArchitect,
    isPlaceBuilding,
    isRepositionArchitect,
    type BuildingType
} from '@tabletop/urbino'

export type ArchitectPlacementEntry = {
    kind: 'architect'
    id: string
    actionIndex: number
    playerId: string
    architectNumber: number
    position: number
}

export type FirstPlayerEntry = {
    kind: 'firstPlayer'
    id: string
    actionIndex: number
    playerId: string
    startingPlayerId: string
}

export type TurnEntry = {
    kind: 'turn'
    id: string
    firstIndex: number
    lastIndex: number
    playerId: string
    move?: { architectNumber: number; position: number }
    build?: { buildingType: BuildingType; position: number }
    passed: boolean
    conceded: boolean
    complete: boolean
}

export type HistoryEntry = ArchitectPlacementEntry | FirstPlayerEntry | TurnEntry

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let architectsPlaced = 0
    let openTurn: TurnEntry | undefined

    const turnFor = (action: { id: string; playerId: string }, index: number): TurnEntry => {
        if (openTurn && openTurn.playerId === action.playerId) {
            openTurn.lastIndex = index
            return openTurn
        }
        openTurn = {
            kind: 'turn',
            id: action.id,
            firstIndex: index,
            lastIndex: index,
            playerId: action.playerId,
            passed: false,
            conceded: false,
            complete: false
        }
        entries.push(openTurn)
        return openTurn
    }

    const closeTurn = (turn: TurnEntry) => {
        turn.complete = true
        openTurn = undefined
    }

    actions.forEach((action, index) => {
        if (isPlaceArchitect(action)) {
            architectsPlaced += 1
            entries.push({
                kind: 'architect',
                id: action.id,
                actionIndex: index,
                playerId: action.playerId,
                architectNumber: architectsPlaced,
                position: action.position
            })
        } else if (isChooseFirstPlayer(action)) {
            entries.push({
                kind: 'firstPlayer',
                id: action.id,
                actionIndex: index,
                playerId: action.playerId,
                startingPlayerId: action.startingPlayerId
            })
        } else if (isRepositionArchitect(action)) {
            turnFor(action, index).move = {
                architectNumber: action.architectIndex + 1,
                position: action.position
            }
        } else if (isPlaceBuilding(action)) {
            const turn = turnFor(action, index)
            turn.build = { buildingType: action.buildingType, position: action.position }
            closeTurn(turn)
        } else if (isPass(action)) {
            const turn = turnFor(action, index)
            turn.passed = true
            closeTurn(turn)
        } else if (isConcede(action)) {
            const turn = turnFor(action, index)
            turn.conceded = true
            closeTurn(turn)
        }
    })

    return entries
}

export function entryContaining(entries: readonly HistoryEntry[], actionIndex: number): HistoryEntry | undefined {
    return entries.find((entry) =>
        entry.kind === 'turn'
            ? entry.firstIndex <= actionIndex && actionIndex <= entry.lastIndex
            : entry.actionIndex === actionIndex
    )
}

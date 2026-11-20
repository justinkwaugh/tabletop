import {
    assertExists,
    isCallGameAction,
    sameCoordinates,
    type AxialCoordinates,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
import {
    isCapture,
    isPlaceMarble,
    MarbleSource,
    type MarbleColor,
    type Ring
} from '@tabletop/zertz'
import { actionNumber, applyToSeeds, placementSeed, seedAt } from '$lib/board/marbleSeeds.js'

type TurnSpan = {
    id: string
    firstIndex: number
    lastIndex: number
    playerId: string
}

// Each marble named carries its speck seed, so it shows as it did on the board.
export type PlacementEntry = TurnSpan & {
    kind: 'placement'
    color: MarbleColor
    seed: number
    placedAt: AxialCoordinates
    fromCaptures: boolean
    removedAt?: AxialCoordinates
    claimed: (Ring & { seed: number })[]
}

export type CaptureEntry = TurnSpan & {
    kind: 'capture'
    jumper: MarbleColor
    jumperSeed: number
    path: AxialCoordinates[]
    captured: { color: MarbleColor; seed: number }[]
}

export type MoveEntry = PlacementEntry | CaptureEntry

// A call, a concession or a stall ends the game with a system action of its own.
export type CallEntry = {
    kind: 'call'
    id: string
    firstIndex: number
    lastIndex: number
    action: CallGameAction
}

export type HistoryEntry = MoveEntry | CallEntry

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    const seeds = new Map<number, number>()
    let chain: CaptureEntry | undefined

    actions.forEach((action, index) => {
        const number = actionNumber(action, index)
        if (isCallGameAction(action)) {
            chain = undefined
            entries.push({
                kind: 'call',
                id: action.id,
                firstIndex: index,
                lastIndex: index,
                action
            })
        } else if (isPlaceMarble(action)) {
            chain = undefined
            const seed = placementSeed(action.coords, number)
            const { metadata } = action
            assertExists(metadata, 'A processed placement has its metadata')
            const claimed = [...metadata.claimedOnPlacing, ...metadata.claimedOnRemoving]
            entries.push({
                kind: 'placement',
                id: action.id,
                firstIndex: index,
                lastIndex: index,
                playerId: action.playerId,
                color: action.color,
                seed,
                placedAt: action.coords,
                fromCaptures: metadata.source === MarbleSource.Captured,
                ...(action.remove === undefined ? {} : { removedAt: action.remove }),
                claimed: claimed.map((ring) => ({
                    ...ring,
                    seed:
                        ring.marbleSeed ??
                        (sameCoordinates(ring.coords, action.coords)
                            ? seed
                            : seedAt(seeds, ring.coords))
                }))
            })
        } else if (isCapture(action)) {
            const { metadata } = action
            assertExists(metadata, 'A processed capture has its metadata')
            if (chain === undefined) {
                chain = {
                    kind: 'capture',
                    id: action.id,
                    firstIndex: index,
                    lastIndex: index,
                    playerId: action.playerId,
                    jumper: metadata.jumper,
                    jumperSeed: metadata.jumperSeed ?? seedAt(seeds, action.from),
                    path: [action.from],
                    captured: []
                }
                entries.push(chain)
            }
            chain.lastIndex = index
            chain.path.push(action.to)
            chain.captured.push({
                color: metadata.captured,
                seed: metadata.capturedSeed ?? seedAt(seeds, metadata.over)
            })
            if (!metadata.continues) {
                chain = undefined
            }
        }
        applyToSeeds(seeds, action, number)
    })

    return entries
}

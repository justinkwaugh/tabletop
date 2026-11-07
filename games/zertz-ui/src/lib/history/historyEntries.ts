import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    isCapture,
    isPlaceMarble,
    MarbleSource,
    type MarbleColor,
    type Ring
} from '@tabletop/zertz'
import { applyToSeeds, placementSeed, seedAt } from '$lib/board/marbleSeeds.js'

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

export type HistoryEntry = PlacementEntry | CaptureEntry

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    const seeds = new Map<string, number>()
    let chain: CaptureEntry | undefined

    actions.forEach((action, index) => {
        if (isPlaceMarble(action)) {
            chain = undefined
            const seed = placementSeed(action.coords, index)
            const claimed = [
                ...(action.metadata?.claimedOnPlacing ?? []),
                ...(action.metadata?.claimedOnRemoving ?? [])
            ]
            entries.push({
                kind: 'placement',
                id: action.id,
                firstIndex: index,
                lastIndex: index,
                playerId: action.playerId,
                color: action.color,
                seed,
                placedAt: action.coords,
                fromCaptures: action.metadata?.source === MarbleSource.Captured,
                ...(action.remove === undefined ? {} : { removedAt: action.remove }),
                claimed: claimed.map((ring) => ({
                    ...ring,
                    seed: sameCoordinates(ring.coords, action.coords)
                        ? seed
                        : seedAt(seeds, ring.coords)
                }))
            })
        } else if (isCapture(action) && action.metadata !== undefined) {
            if (chain === undefined) {
                chain = {
                    kind: 'capture',
                    id: action.id,
                    firstIndex: index,
                    lastIndex: index,
                    playerId: action.playerId,
                    jumper: action.metadata.jumper,
                    jumperSeed: seedAt(seeds, action.from),
                    path: [action.from],
                    captured: []
                }
                entries.push(chain)
            }
            chain.lastIndex = index
            chain.path.push(action.to)
            chain.captured.push({
                color: action.metadata.captured,
                seed: seedAt(seeds, action.metadata.over)
            })
            if (!action.metadata.continues) {
                chain = undefined
            }
        }
        applyToSeeds(seeds, action, index)
    })

    return entries
}

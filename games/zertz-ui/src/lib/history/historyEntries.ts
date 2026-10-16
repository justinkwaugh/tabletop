import type { AxialCoordinates, GameAction } from '@tabletop/common'
import {
    isCapture,
    isPlaceMarble,
    isRemoveRing,
    MarbleSource,
    type MarbleColor,
    type Ring
} from '@tabletop/zertz'

type TurnSpan = {
    id: string
    firstIndex: number
    lastIndex: number
    playerId: string
}

export type PlacementEntry = TurnSpan & {
    kind: 'placement'
    color: MarbleColor
    placedAt: AxialCoordinates
    fromCaptures: boolean
    removedAt?: AxialCoordinates
    claimed: Ring[]
}

export type CaptureEntry = TurnSpan & {
    kind: 'capture'
    jumper: MarbleColor
    path: AxialCoordinates[]
    captured: MarbleColor[]
}

export type HistoryEntry = PlacementEntry | CaptureEntry

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let chain: CaptureEntry | undefined

    actions.forEach((action, index) => {
        const last = entries.at(-1)
        if (isPlaceMarble(action)) {
            chain = undefined
            entries.push({
                kind: 'placement',
                id: action.id,
                firstIndex: index,
                lastIndex: index,
                playerId: action.playerId,
                color: action.color,
                placedAt: action.coords,
                fromCaptures: action.metadata?.source === MarbleSource.Captured,
                claimed: [...(action.metadata?.claimedRings ?? [])]
            })
        } else if (isRemoveRing(action) && last?.kind === 'placement') {
            last.lastIndex = index
            last.removedAt = action.coords
            last.claimed.push(...(action.metadata?.claimedRings ?? []))
        } else if (isCapture(action) && action.metadata !== undefined) {
            if (chain === undefined) {
                chain = {
                    kind: 'capture',
                    id: action.id,
                    firstIndex: index,
                    lastIndex: index,
                    playerId: action.playerId,
                    jumper: action.metadata.jumper,
                    path: [action.from],
                    captured: []
                }
                entries.push(chain)
            }
            chain.lastIndex = index
            chain.path.push(action.to)
            chain.captured.push(action.metadata.captured)
            if (!action.metadata.continues) {
                chain = undefined
            }
        }
    })

    return entries
}

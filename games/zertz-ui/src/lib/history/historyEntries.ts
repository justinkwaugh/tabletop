import type { GameAction } from '@tabletop/common'
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
    fromCaptures: boolean
    removedRing: boolean
    claimed: MarbleColor[]
}

export type CaptureEntry = TurnSpan & {
    kind: 'capture'
    captured: MarbleColor[]
}

export type HistoryEntry = PlacementEntry | CaptureEntry

function claimedMarbles(rings: readonly Ring[]): MarbleColor[] {
    return rings.flatMap((ring) => (ring.marble === undefined ? [] : [ring.marble]))
}

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
                fromCaptures: action.metadata?.source === MarbleSource.Captured,
                removedRing: false,
                claimed: claimedMarbles(action.metadata?.claimedRings ?? [])
            })
        } else if (isRemoveRing(action) && last?.kind === 'placement') {
            last.lastIndex = index
            last.removedRing = true
            last.claimed.push(...claimedMarbles(action.metadata?.claimedRings ?? []))
        } else if (isCapture(action)) {
            if (chain === undefined) {
                chain = {
                    kind: 'capture',
                    id: action.id,
                    firstIndex: index,
                    lastIndex: index,
                    playerId: action.playerId,
                    captured: []
                }
                entries.push(chain)
            }
            chain.lastIndex = index
            if (action.metadata !== undefined) {
                chain.captured.push(action.metadata.captured)
            }
            if (action.metadata?.continues !== true) {
                chain = undefined
            }
        }
    })

    return entries
}

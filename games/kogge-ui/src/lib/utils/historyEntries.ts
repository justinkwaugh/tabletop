import type { GameAction } from '@tabletop/common'
import {
    isBeginRound,
    isChooseSpoils,
    isChooseStartCity,
    isDivideSpoils,
    isEndTurn,
    isExpelRaider,
    isMoveGuildMaster,
    isPassBid,
    isPlaceBid,
    isResolveAuction,
    isRevealStartCities
} from '@tabletop/kogge'
import { describeAction, type Story } from './story.js'

export type HistoryEntry =
    | { kind: 'round'; round: number; index: number }
    | { kind: 'setup'; lines: Story[]; firstIndex: number; lastIndex: number }
    | { kind: 'auction'; lines: Story[]; firstIndex: number; lastIndex: number }
    | { kind: 'guildMaster'; line: Story; index: number }
    | {
          kind: 'turn'
          playerId: string
          lines: Story[]
          firstIndex: number
          lastIndex: number
          complete: boolean
      }

type GroupKind = 'setup' | 'auction' | 'turn'

// One entry per round marker, auction, guild master move and merchant's turn; a turn grows
// with each step until it ends, including a raid's split, choice and expulsion.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let open: Extract<HistoryEntry, { kind: GroupKind }> | undefined

    const close = () => {
        if (open?.kind === 'turn') {
            open.complete = true
        }
        open = undefined
    }

    for (const action of actions) {
        const index = action.index ?? 0
        const story = describeAction(action)
        if (isBeginRound(action)) {
            close()
            entries.push({ kind: 'round', round: action.metadata?.round ?? 0, index })
            if (story) {
                open = { kind: 'auction', lines: [story], firstIndex: index, lastIndex: index }
                entries.push(open)
            }
            continue
        }
        if (isChooseStartCity(action) || isRevealStartCities(action)) {
            if (open?.kind !== 'setup') {
                close()
                open = { kind: 'setup', lines: [], firstIndex: index, lastIndex: index }
                entries.push(open)
            }
            if (story && isRevealStartCities(action)) open.lines.push(story)
            open.lastIndex = index
            continue
        }
        if (isPlaceBid(action) || isPassBid(action) || isResolveAuction(action)) {
            if (open?.kind !== 'auction') {
                close()
                open = { kind: 'auction', lines: [], firstIndex: index, lastIndex: index }
                entries.push(open)
            }
            if (story) open.lines.push(story)
            open.lastIndex = index
            if (isResolveAuction(action)) close()
            continue
        }
        if (isMoveGuildMaster(action)) {
            close()
            if (story) entries.push({ kind: 'guildMaster', line: story, index })
            continue
        }
        const playerId = isExpelRaider(action) ? undefined : action.playerId
        if (
            open?.kind !== 'turn' ||
            (playerId !== undefined && open.playerId !== playerId && !isFollowUp(action))
        ) {
            close()
            if (!playerId) continue
            open = {
                kind: 'turn',
                playerId,
                lines: [],
                firstIndex: index,
                lastIndex: index,
                complete: false
            }
            entries.push(open)
        }
        if (story) open.lines.push(story)
        open.lastIndex = index
        if (isEndTurn(action) || isExpelRaider(action)) close()
    }
    return entries
}

function isFollowUp(action: GameAction): boolean {
    return isDivideSpoils(action) || isChooseSpoils(action)
}

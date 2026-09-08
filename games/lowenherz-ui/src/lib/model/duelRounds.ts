import type { GameAction } from '@tabletop/common'
import {
    isSubmitDuelBid,
    type SubmitDuelBid,
    type SubmitDuelBidMetadata
} from '@tabletop/lowenherz'

// Protected histories keep earlier bids sealed even after resolution. The resolving
// action publishes the whole round; older games instead carry amounts on each bid.
export function revealedDuelRoundEndingWith(
    actions: GameAction[],
    resolvingBid: SubmitDuelBid
): NonNullable<SubmitDuelBidMetadata['roundResult']>['bids'] {
    if (!resolvingBid.metadata?.duelResult) return []
    if (resolvingBid.metadata.roundResult) return resolvingBid.metadata.roundResult.bids
    return duelRoundEndingWith(actions, resolvingBid).flatMap((bid) =>
        bid.amount === undefined
            ? []
            : [
                  {
                      playerId: bid.playerId,
                      amount: bid.amount,
                      treasureValues: (bid.metadata?.treasureCardsUsed ?? []).map(
                          (card) => card.value ?? 0
                      )
                  }
              ]
    )
}

// Splits a flat run of consecutive SubmitDuelBid actions into per-round groups. Every
// duelist bids exactly once per round, so the same player bidding again can only mean a
// new round just started - that repeat is the only signal needed to find round boundaries.
export function splitDuelBidsIntoRounds(bids: SubmitDuelBid[]): SubmitDuelBid[][] {
    const rounds: SubmitDuelBid[][] = []
    let current: SubmitDuelBid[] = []
    let seen = new Set<string>()
    for (const bid of bids) {
        if (seen.has(bid.playerId)) {
            rounds.push(current)
            current = []
            seen = new Set()
        }
        current.push(bid)
        seen.add(bid.playerId)
    }
    if (current.length > 0) rounds.push(current)
    return rounds
}

// The bids of the duel round that the given bid closed, in the order they were placed.
// Bids of one round are contiguous in the action log (Dueling accepts nothing else), and
// a re-duel's bids follow the tied round's directly, so the walk back stops at the first
// previous resolving bid, non-bid action, or repeated player.
export function duelRoundEndingWith(
    actions: GameAction[],
    resolvingBid: SubmitDuelBid
): SubmitDuelBid[] {
    const end = actions.findIndex((action) => action.id === resolvingBid.id)
    if (end < 0) return [resolvingBid]

    const round: SubmitDuelBid[] = []
    const seen = new Set<string>()
    for (let i = end; i >= 0; i--) {
        const action = actions[i]
        if (!isSubmitDuelBid(action) || seen.has(action.playerId)) break
        if (i < end && action.metadata?.duelResult) break
        round.unshift(action)
        seen.add(action.playerId)
    }
    return round
}

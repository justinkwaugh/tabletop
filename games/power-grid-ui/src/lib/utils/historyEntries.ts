import type { GameAction } from '@tabletop/common'
import {
    isBuildCities,
    isBuyResources,
    isChoosePlant,
    isCloseAuctions,
    isPassAuction,
    isPassBid,
    isPowerCities,
    isRaiseBid,
    isReplacePlant,
    isRestock,
    isScrapPlant,
    isStartStep2,
    isPlaceTrustHouse,
    isTrustBuysResources,
    isTrustTakesPlant
} from '@tabletop/power-grid'
import { acts, describeAction, type Line, type Segment } from './describe.js'

export type EntryKind =
    | 'setup'
    | 'auction'
    | 'pass'
    | 'market'
    | 'resources'
    | 'build'
    | 'step'
    | 'bureaucracy'
    | 'trust'

export type HistoryEntry = {
    key: string
    kind: EntryKind
    playerId?: string
    firstIndex: number
    lastIndex: number
    lines: Line[]
}

export type HistoryPhase = { phase: number; entries: HistoryEntry[] }

export type HistoryRound = { round: number; firstIndex: number; phases: HistoryPhase[] }

function phaseOf(action: GameAction): number {
    if (isBuyResources(action)) return 3
    if (isBuildCities(action)) return 4
    if (isStartStep2(action) || isPowerCities(action) || isRestock(action)) return 5
    return 2
}

const text = (value: string): Segment => ({ kind: 'text', text: value })

type AuctionDraft = { entry: HistoryEntry; bids: Segment[]; closed: boolean }

export function historyRounds(actions: readonly GameAction[]): HistoryRound[] {
    const rounds: HistoryRound[] = [{ round: 1, firstIndex: 0, phases: [] }]
    let auction: AuctionDraft | undefined
    let bureaucracy: HistoryEntry | undefined

    const currentRound = () => rounds[rounds.length - 1]
    const push = (phase: number, entry: HistoryEntry) => {
        const round = currentRound()
        let last = round.phases.at(-1)
        if (last?.phase !== phase) {
            last = { phase, entries: [] }
            round.phases.push(last)
        }
        last.entries.push(entry)
    }
    const extend = (entry: HistoryEntry, index: number, lines: Line[]) => {
        entry.lastIndex = index
        entry.lines.push(...lines)
    }

    actions.forEach((action, position) => {
        const index = action.index ?? position
        const key = action.id
        if (isChoosePlant(action) || isRaiseBid(action) || isPassBid(action)) {
            if (isChoosePlant(action)) {
                auction = {
                    entry: {
                        key,
                        kind: 'auction',
                        playerId: action.playerId,
                        firstIndex: index,
                        lastIndex: index,
                        lines: []
                    },
                    bids: [],
                    closed: false
                }
                push(2, auction.entry)
            }
            if (!auction) return
            const separator = auction.bids.length ? [text(' · ')] : []
            if (isChoosePlant(action)) {
                auction.bids.push({ kind: 'player', playerId: action.playerId }, text(' '), {
                    kind: 'money',
                    amount: action.bid
                })
            } else if (isRaiseBid(action)) {
                auction.bids.push(
                    ...separator,
                    { kind: 'player', playerId: action.playerId },
                    text(' '),
                    { kind: 'money', amount: action.amount }
                )
            } else {
                auction.bids.push(...separator, ...acts(action.playerId, ' passes', ' pass'))
            }
            for (const withdrawn of action.metadata?.withdrawn ?? []) {
                auction.bids.push(text(' · '), ...acts(withdrawn, ' cannot raise', ' cannot raise'))
            }
            auction.entry.lastIndex = index
            const winner = action.metadata?.winner
            const plant = action.metadata?.plant
            auction.entry.lines = winner
                ? [
                      [
                          ...acts(winner.playerId, ' buys', ' buy'),
                          text(' plant '),
                          { kind: 'plant', plant: plant ?? 0 },
                          text(' for '),
                          { kind: 'money', amount: winner.amount }
                      ],
                      [text('Bids: '), ...auction.bids]
                  ]
                : [
                      [text('Auction for plant '), { kind: 'plant', plant: plant ?? 0 }],
                      [text('Bids: '), ...auction.bids]
                  ]
            if (winner) {
                auction.entry.playerId = winner.playerId
                auction.closed = true
            }
            return
        }
        if ((isReplacePlant(action) || isScrapPlant(action)) && auction?.closed) {
            extend(auction.entry, index, describeAction(action))
            return
        }
        const lines = describeAction(action)
        if (isPlaceTrustHouse(action)) {
            push(1, {
                key,
                kind: 'setup',
                playerId: action.playerId,
                firstIndex: index,
                lastIndex: index,
                lines
            })
            return
        }
        if (isTrustTakesPlant(action)) {
            push(2, { key, kind: 'trust', firstIndex: index, lastIndex: index, lines })
            return
        }
        if (isTrustBuysResources(action)) {
            if (lines.length)
                push(3, { key, kind: 'trust', firstIndex: index, lastIndex: index, lines })
            return
        }
        if (isPassAuction(action)) {
            push(2, {
                key,
                kind: 'pass',
                playerId: action.playerId,
                firstIndex: index,
                lastIndex: index,
                lines
            })
            return
        }
        if (isCloseAuctions(action) || isReplacePlant(action) || isScrapPlant(action)) {
            if (lines.length)
                push(2, { key, kind: 'market', firstIndex: index, lastIndex: index, lines })
            return
        }
        if (isBuyResources(action)) {
            push(3, {
                key,
                kind: 'resources',
                playerId: action.playerId,
                firstIndex: index,
                lastIndex: index,
                lines
            })
            return
        }
        if (isBuildCities(action)) {
            push(4, {
                key,
                kind: 'build',
                playerId: action.playerId,
                firstIndex: index,
                lastIndex: index,
                lines
            })
            return
        }
        if (isStartStep2(action)) {
            push(5, { key, kind: 'step', firstIndex: index, lastIndex: index, lines })
            return
        }
        if (isPowerCities(action) || isRestock(action)) {
            if (!bureaucracy) {
                bureaucracy = {
                    key,
                    kind: 'bureaucracy',
                    firstIndex: index,
                    lastIndex: index,
                    lines: []
                }
                push(phaseOf(action), bureaucracy)
            }
            extend(bureaucracy, index, lines)
            if (isRestock(action)) {
                bureaucracy = undefined
                auction = undefined
                rounds.push({ round: currentRound().round + 1, firstIndex: index + 1, phases: [] })
            }
        }
    })
    return rounds.filter((round) => round.phases.length > 0)
}

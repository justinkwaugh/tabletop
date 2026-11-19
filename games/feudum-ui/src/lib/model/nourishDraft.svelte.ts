import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    GuildById,
    Nourish,
    nourishGroup,
    nourishOffer,
    nourishPreview,
    type GuildId,
    type NourishOffer,
    type PawnNumber,
    type SpaceId,
    type WildTileSpend
} from '@tabletop/feudum'
import { pawnTarget, type BoardTarget, type ChipNote, type StagePick } from './boardOffer.js'
import { spaceLabel, type FlowPick, type FlowPlay } from './cardFlows.js'
import type { TurnContext } from './cardModes.js'
import { DeciderDraft, draftChoice, playUnless, type DraftChoice } from './deciderDraft.svelte.js'
import { withLoneChoice } from './stagedDraft.svelte.js'
import type { TurnPrimary } from './turnDraft.svelte.js'
import { tileArt, tileName } from './tileName.js'

export interface Feeding {
    readonly wineFed: readonly PawnNumber[]
    readonly unfed: readonly PawnNumber[]
}

export type NourishValues = {
    /** R-4.3.3 Stacked: each press one tile, before the feeding, which is read after them. */
    cover: readonly WildTileSpend[]
    /** R-4.10.1 The preselection is its `auto` entry (S53); each press stacks. */
    feeding: Feeding
}

export const NourishStageOrder: readonly (keyof NourishValues)[] = ['cover', 'feeding']

export type Feed = 'food' | 'wine' | 'unfed'

const FeedOrder: readonly Feed[] = ['food', 'wine', 'unfed']
const FeedLabels: Readonly<Record<Feed, string>> = { food: 'Food', wine: 'Wine', unfed: 'Unfed' }

/**
 * Contract, Round end: food and wine are their pieces; "unfed" is its word. Wine alone keeps a
 * line, its cost: R-4.10.2 it feeds this round and the next, and next round the pawn's strength
 * is 0.
 */
const FeedShown: Readonly<Record<Feed, string>> = { food: '', wine: '', unfed: 'unfed' }
const WineCost = '2 rounds · 0 strength'
const FeedArt = { food: 'food', wine: 'sulfur' } as const

/** R-4.3.3 The tile line: shown only when food and wine fall short and a tile could cover it. */
export const CoverLine = 'A tile feeds 1'

/**
 * One feed for one pawn. `spent` is a feed every unit of which another pawn eats: a press still
 * moves it here, and the pawn pressed into it last takes this one's feed (R-4.10.1).
 */
export interface NourishOption extends DraftChoice {
    readonly feed: Feed
    /** Wine's cost, beneath its piece; no other feed has a line. */
    readonly caption?: string
    readonly spent: boolean
    /** The good the feed pays, drawn: R-4.10.2 wine is a barrel's sulfur. */
    readonly good?: 'food' | 'sulfur'
}

export interface NourishPawnRow {
    readonly n: PawnNumber
    readonly character: GuildId
    readonly spaceId: SpaceId
    /** The pawn's character, as a name. */
    readonly name: string
    /** The space it stands on. */
    readonly place: string
    readonly label: string
    readonly feed: Feed
    readonly unfed: boolean
    readonly choices: readonly NourishOption[]
}

/** The send's counts, which it draws as art. */
export interface NourishSend {
    readonly fed: number
    readonly food: number
    readonly wine: number
}

export interface NourishPanel {
    readonly pawns: readonly NourishPawnRow[]
    readonly covers?: readonly DraftChoice[]
    readonly coverLine?: string
    readonly send: NourishSend
    readonly primary: TurnPrimary
}

/**
 * R-4.10.1 The send names how many pawns eat and with what, and how many are left: "Feed 2 · 2
 * food" (drawn as art), "Feed 2 · leave 1", "Leave the merchant".
 */
function sendLabel({ fed, food, wine }: NourishSend, left: readonly GuildId[]): string {
    if (left.length === 0) {
        const paid = [...(food > 0 ? [`${food} food`] : []), ...(wine > 0 ? [`${wine} wine`] : [])]
        return [`Feed ${fed}`, ...paid].join(' · ')
    }
    if (fed > 0) {
        return `Feed ${fed} · leave ${left.length}`
    }
    return left.length === 1 ? `Leave the ${left[0]}` : `Leave ${left.length} pawns`
}

/** R-4.10.1 The paid good drawn on a fed pawn's chip on the map. */
function payChip(feed: 'food' | 'wine'): ChipNote {
    return {
        kind: 'role',
        label: `1 ${feed}`,
        art: [{ kind: 'good', good: FeedArt[feed], count: 1 }]
    }
}

function feedOf({ wineFed, unfed }: Feeding, n: PawnNumber): Feed {
    if (wineFed.includes(n)) {
        return 'wine'
    }
    return unfed.includes(n) ? 'unfed' : 'food'
}

function feedingOf(
    pawns: readonly { readonly n: PawnNumber }[],
    feedFor: (n: PawnNumber) => Feed
): Feeding {
    const numbers = pawns.map(({ n }) => n)
    return {
        wineFed: numbers.filter((n) => feedFor(n) === 'wine'),
        unfed: numbers.filter((n) => feedFor(n) === 'unfed')
    }
}

function capacities(offer: NourishOffer): Readonly<Record<Feed, number>> {
    return {
        food: offer.food,
        wine: offer.barrel,
        unfed: Math.max(0, offer.pawns.length - offer.food - offer.barrel)
    }
}

/**
 * R-4.10.1 The feeding after a press: the pawn goes to that feed, and if the feed is full, the pawn
 * pressed last into it comes back to where this one was, so no pawn it could feed goes unfed.
 */
export function feedingAfterPress(
    offer: NourishOffer,
    feeding: Feeding,
    n: PawnNumber,
    feed: Feed
): Feeding {
    const from = feedOf(feeding, n)
    if (from === feed) {
        return feeding
    }
    const occupants = offer.pawns.map((pawn) => pawn.n).filter((m) => feedOf(feeding, m) === feed)
    const swapped = occupants.length >= capacities(offer)[feed] ? occupants.at(-1) : undefined
    return feedingOf(offer.pawns, (m) => {
        if (m === n) {
            return feed
        }
        return m === swapped ? from : feedOf(feeding, m)
    })
}

/**
 * R-4.10, R-4.10-H4 A seat nourishing asks. Every asked seat decides at once, so the draft outlives
 * another seat's Action; it is read back only under its own key (`keyOf`: the seat, the round, and
 * the seat's own last Action), so a shared screen never shows it to the next seat, and the seat's
 * own at-will play starts it afresh. Its choice always ends on the primary button.
 */
export class NourishDraft extends DeciderDraft<NourishValues> {
    private key: string | undefined = $state.raw()

    constructor(
        contextOf: () => TurnContext | undefined,
        private readonly keyOf: () => string | undefined
    ) {
        super(NourishStageOrder, contextOf)
    }

    protected override write(stages: StagedSelectionState<NourishValues>): void {
        this.key = this.keyOf()
        super.write(stages)
    }

    protected override withAutos(
        kept: StagedSelectionState<NourishValues>,
        { state, playerId }: TurnContext
    ): StagedSelectionState<NourishValues> {
        const current = this.keyOf()
        const stored = current !== undefined && this.key === current ? kept : {}
        const offer = nourishOffer(state, playerId, stored.cover?.value ?? [])
        return offer
            ? withLoneChoice<NourishValues, 'feeding'>(stored, NourishStageOrder, 'feeding', [
                  offer.preselected
              ])
            : stored
    }

    private offer = $derived.by(() => {
        const context = this.contextOf()
        return context && nourishOffer(context.state, context.playerId, this.value('cover') ?? [])
    })

    private input = $derived.by(() => {
        const { wineFed = [], unfed = [] } = this.value('feeding') ?? {}
        const wildTiles = this.value('cover') ?? []
        return {
            wineFed: [...wineFed],
            unfed: [...unfed],
            ...(wildTiles.length > 0 ? { wildTiles: [...wildTiles] } : {})
        }
    })

    private preview = $derived.by(() => {
        const context = this.contextOf()
        return context && this.offer
            ? nourishPreview(context.state, context.playerId, this.input)
            : undefined
    })

    /** R-4.10-H4 The send goes in the round's simultaneous group, as a finalised hand does. */
    play: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        const { preview, input } = this
        return (
            context &&
            preview &&
            playUnless(preview.refused, (maker) =>
                maker.createPlayerAction(Nourish, {
                    ...input,
                    simultaneousGroupId: nourishGroup(context.state)
                })
            )
        )
    })

    private pressFeed(n: PawnNumber, feed: Feed) {
        const { offer } = this
        const feeding = this.value('feeding')
        if (!offer || !feeding) {
            return
        }
        const after = feedingAfterPress(offer, feeding, n, feed)
        if (after !== feeding) {
            this.push('feeding', after)
        }
    }

    /** R-4.3.3 A tile's good: pressed again it comes off, and a new preselection follows. */
    private pressCover(spend: WildTileSpend) {
        const cover = this.value('cover') ?? []
        const same = cover.some(
            ({ tileId, sulfurToBarrel }) =>
                tileId === spend.tileId && sulfurToBarrel === spend.sulfurToBarrel
        )
        const others = cover.filter(({ tileId }) => tileId !== spend.tileId)
        this.push('cover', same ? others : [...others, spend])
    }

    /**
     * R-4.3.3, R-4.10-H4 What the haversack holds for each tile is the offer's: another seat's
     * feeding, applied first, can take the last of a good, and the rows then say so.
     */
    private coverRows(
        { state, playerId }: TurnContext,
        offer: NourishOffer
    ): readonly DraftChoice[] {
        const cover = this.value('cover') ?? []
        return state.getPlayerState(playerId).regionTiles.flatMap((tileId) => {
            const food: WildTileSpend = { tileId, good: 'food' }
            const wine: WildTileSpend = { tileId, good: 'sulfur', sulfurToBarrel: true }
            const spent = cover.find((spend) => spend.tileId === tileId)
            /** A good the haversack can't bring for this isn't drawn, unless it is picked. */
            const row = (
                spend: WildTileSpend,
                name: string,
                good: 'food' | 'sulfur'
            ): DraftChoice[] => {
                const picked = spent?.good === spend.good
                const left = offer.haversackFor[good]
                if (!picked && (left <= 0 || (!spent && !offer.wildTileNeeded))) {
                    return []
                }
                return [
                    {
                        ...draftChoice(`${tileName(tileId)} tile → ${name}`, picked, () => {
                            this.pressCover(spend)
                        }),
                        art: tileArt(state, tileId),
                        shown: picked && left < 0 ? `for ${name} · none left` : `for ${name}`
                    }
                ]
            }
            return [
                ...row(food, 'food', 'food'),
                ...(offer.sulfurToBarrel || spent?.good === 'sulfur'
                    ? row(wine, 'wine', 'sulfur')
                    : [])
            ]
        })
    }

    panel: NourishPanel | undefined = $derived.by(() => {
        const context = this.contextOf()
        const { offer, preview } = this
        const feeding = this.value('feeding')
        if (!context || !offer || !preview || !feeding) {
            return undefined
        }
        const room = capacities(offer)
        const feedOfPawn = (n: PawnNumber) => feedOf(feeding, n)
        const eating = (feed: Feed) => offer.pawns.filter(({ n }) => feedOfPawn(n) === feed).length
        const hasCover = offer.wildTileNeeded || (this.value('cover') ?? []).length > 0
        const send: NourishSend = {
            fed: offer.pawns.length - preview.unfed,
            food: preview.food,
            wine: preview.wine
        }
        const left = offer.pawns.filter(({ n }) => feedOfPawn(n) === 'unfed')
        // R-4.10-H3 A feed stands while there is some of it to give; "Unfed" only when both fall
        // short. A feed another pawn eats stands, and a press moves it (R-4.10.1).
        const shown = FeedOrder.filter((one) => room[one] > 0)
        return {
            pawns: offer.pawns.map(({ n, character, spaceId }) => {
                const feed = feedOfPawn(n)
                return {
                    n,
                    character,
                    spaceId,
                    name: GuildById[character].name,
                    place: spaceLabel(spaceId),
                    label: `${character} at ${spaceLabel(spaceId)}`,
                    feed,
                    unfed: feed === 'unfed',
                    choices: shown.map((one): NourishOption => {
                        const spent = feed !== one && eating(one) >= room[one]
                        return {
                            ...draftChoice(FeedLabels[one], feed === one, () => {
                                this.pressFeed(n, one)
                            }),
                            ...(one === 'unfed' ? {} : { good: FeedArt[one] }),
                            shown: FeedShown[one],
                            feed: one,
                            ...(one === 'wine' ? { caption: WineCost } : {}),
                            spent,
                            lights: () => [pawnTarget(context.playerId, n)]
                        }
                    })
                }
            }),
            ...(hasCover ? { covers: this.coverRows(context, offer), coverLine: CoverLine } : {}),
            send,
            primary: {
                label: sendLabel(
                    send,
                    left.map(({ character }) => character)
                ),
                enabled: this.play !== undefined
            }
        }
    })

    /** R-4.10.1 Each pawn to feed lights; a press moves it to its next feed. */
    private picks: readonly FlowPick[] = $derived.by(() => {
        const context = this.contextOf()
        const { offer } = this
        const feeding = this.value('feeding')
        if (!context || !offer || !feeding) {
            return []
        }
        const room = capacities(offer)
        const feeds = FeedOrder.filter((feed) => room[feed] > 0)
        return offer.pawns.map(({ n }) => {
            const feed = feedOf(feeding, n)
            const next = feeds[(feeds.indexOf(feed) + 1) % feeds.length]
            return {
                target: pawnTarget(context.playerId, n),
                notes: [
                    feed === 'unfed' ? { kind: 'threat' as const, label: 'home' } : payChip(feed)
                ],
                press: () => {
                    this.pressFeed(n, next)
                }
            }
        })
    })

    /** R-4.10-H4 The map pick names its decider: several seats decide at once. */
    get pick(): (StagePick & { readonly deciderId: string }) | undefined {
        const context = this.contextOf()
        return context && this.picks.length > 0
            ? {
                  deciderId: context.playerId,
                  targets: this.picks.map(({ target, notes }) => ({
                      target,
                      ...(notes ? { notes } : {})
                  })),
                  picked: []
              }
            : undefined
    }

    pickOf(target: BoardTarget): FlowPick | undefined {
        return this.picks.find((pick) => pick.target === target)
    }
}

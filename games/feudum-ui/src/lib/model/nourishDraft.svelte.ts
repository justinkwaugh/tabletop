import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    Nourish,
    nourishOffer,
    nourishPreview,
    type GuildId,
    type NourishOffer,
    type PawnNumber,
    type SpaceId,
    type WildTileSpend
} from '@tabletop/feudum'
import { pawnTarget, type BoardTarget, type StagePick } from './boardOffer.js'
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

export interface NourishPawnRow {
    readonly n: PawnNumber
    readonly character: GuildId
    readonly spaceId: SpaceId
    readonly label: string
    readonly feed: Feed
    readonly choices: readonly DraftChoice[]
}

export interface NourishPanel {
    readonly pawns: readonly NourishPawnRow[]
    readonly covers?: readonly DraftChoice[]
    readonly primary: TurnPrimary
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

/** R-4.10 The seat the game asks. Its choice always ends on the primary button. */
export class NourishDraft extends DeciderDraft<NourishValues> {
    constructor(contextOf: () => TurnContext | undefined) {
        super(NourishStageOrder, contextOf)
    }

    protected override withAutos(
        stored: StagedSelectionState<NourishValues>,
        { state, playerId }: TurnContext
    ): StagedSelectionState<NourishValues> {
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

    play: FlowPlay | undefined = $derived.by(() => {
        const { preview, input } = this
        return (
            preview &&
            playUnless(preview.refused, (maker) => maker.createPlayerAction(Nourish, input))
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

    private coverRows(
        { state, playerId }: TurnContext,
        offer: NourishOffer
    ): readonly DraftChoice[] {
        const cover = this.value('cover') ?? []
        const { haversack } = state.supply
        return state.getPlayerState(playerId).regionTiles.flatMap((tileId) => {
            const food: WildTileSpend = { tileId, good: 'food' }
            const wine: WildTileSpend = { tileId, good: 'sulfur', sulfurToBarrel: true }
            const spent = cover.find((spend) => spend.tileId === tileId)
            const row = (spend: WildTileSpend, name: string, none: boolean) => {
                const picked = spent?.good === spend.good
                return {
                    ...draftChoice(
                        `${tileName(tileId)} tile → ${name}`,
                        picked,
                        () => {
                            this.pressCover(spend)
                        },
                        !picked && (none || (!spent && !offer.wildTileNeeded))
                            ? `The haversack can't bring ${name} for this.`
                            : undefined
                    ),
                    art: tileArt(state, tileId),
                    shown: `for ${name}`
                }
            }
            return [
                row(food, 'food', haversack.food === 0),
                ...(offer.sulfurToBarrel || spent?.good === 'sulfur'
                    ? [row(wine, 'wine', haversack.sulfur === 0)]
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
        const parts = [
            ...(preview.food > 0 ? [`${preview.food} food`] : []),
            ...(preview.wine > 0 ? [`${preview.wine} wine`] : [])
        ]
        const hasCover = offer.wildTileNeeded || (this.value('cover') ?? []).length > 0
        return {
            pawns: offer.pawns.map(({ n, character, spaceId }) => {
                const feed = feedOf(feeding, n)
                return {
                    n,
                    character,
                    spaceId,
                    label: `${character} at ${spaceLabel(spaceId)}`,
                    feed,
                    choices: FeedOrder.filter((one) => room[one] > 0).map((one) => ({
                        ...draftChoice(
                            FeedLabels[one],
                            feed === one,
                            () => {
                                this.pressFeed(n, one)
                            },
                            undefined,
                            one === 'unfed'
                                ? { kind: 'threat', label: 'returns to supply' }
                                : undefined
                        ),
                        lights: () => [pawnTarget(context.playerId, n)]
                    }))
                }
            }),
            ...(hasCover ? { covers: this.coverRows(context, offer) } : {}),
            primary: {
                label: `Feed: ${parts.length > 0 ? parts.join(', ') : 'none'}`,
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
                ...(feed === 'unfed'
                    ? { notes: [{ kind: 'threat' as const, label: 'returns to supply' }] }
                    : {}),
                press: () => {
                    this.pressFeed(n, next)
                }
            }
        })
    })

    get pick(): StagePick | undefined {
        return this.picks.length > 0
            ? {
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

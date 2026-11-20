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
    /** R-4.3.3 Stacked: one tile per press, read before the feeding. */
    cover: readonly WildTileSpend[]
    /** R-4.10.1 The preselection is its `auto` entry (S53); each press stacks. */
    feeding: Feeding
}

export const NourishStageOrder: readonly (keyof NourishValues)[] = ['cover', 'feeding']

export type Feed = 'food' | 'wine' | 'unfed'

const FeedOrder: readonly Feed[] = ['food', 'wine', 'unfed']
const FeedLabels: Readonly<Record<Feed, string>> = { food: 'Food', wine: 'Wine', unfed: 'Unfed' }

/** Contract, Round end; R-4.10.2 wine feeds two rounds, and the pawn's strength is 0 the next. */
const FeedShown: Readonly<Record<Feed, string>> = { food: '', wine: '', unfed: 'unfed' }
const WineCost = '2 rounds · 0 strength'
const FeedArt = { food: 'food', wine: 'sulfur' } as const

/** R-4.3.3 The tile line: shown only when food and wine fall short and a tile could cover it. */
export const CoverLine = 'A tile feeds 1'

/** R-4.10.1 A `spent` feed is all eaten by others; a press swaps out the last pawn into it. */
export interface NourishOption extends DraftChoice {
    readonly feed: Feed
    readonly caption?: string
    readonly spent: boolean
    /** R-4.10.2 Wine is a barrel's sulfur. */
    readonly good?: 'food' | 'sulfur'
}

export interface NourishPawnRow {
    readonly n: PawnNumber
    readonly character: GuildId
    readonly spaceId: SpaceId
    readonly name: string
    readonly place: string
    readonly label: string
    readonly feed: Feed
    readonly unfed: boolean
    readonly choices: readonly NourishOption[]
}

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

/** R-4.10-H4 Seats decide at once; read back only under `keyOf`, never by the next seat. */
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
        const after = NourishDraft.feedingAfterPress(offer, feeding, n, feed)
        if (after !== feeding) {
            this.push('feeding', after)
        }
    }

    /** R-4.3.3 Pressed again, a tile's good comes off. */
    private pressCover(spend: WildTileSpend) {
        const cover = this.value('cover') ?? []
        const same = cover.some(
            ({ tileId, sulfurToBarrel }) =>
                tileId === spend.tileId && sulfurToBarrel === spend.sulfurToBarrel
        )
        const others = cover.filter(({ tileId }) => tileId !== spend.tileId)
        this.push('cover', same ? others : [...others, spend])
    }

    /** R-4.3.3, R-4.10-H4 Another seat's feeding, applied first, can take the last of a good. */
    private coverRows(
        { state, playerId }: TurnContext,
        offer: NourishOffer
    ): readonly DraftChoice[] {
        const cover = this.value('cover') ?? []
        return state.getPlayerState(playerId).regionTiles.flatMap((tileId) => {
            const food: WildTileSpend = { tileId, good: 'food' }
            const wine: WildTileSpend = { tileId, good: 'sulfur', sulfurToBarrel: true }
            const spent = cover.find((spend) => spend.tileId === tileId)
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
        const room = NourishDraft.capacities(offer)
        const feedOfPawn = (n: PawnNumber) => NourishDraft.feedOf(feeding, n)
        const eating = (feed: Feed) => offer.pawns.filter(({ n }) => feedOfPawn(n) === feed).length
        const hasCover = offer.wildTileNeeded || (this.value('cover') ?? []).length > 0
        const send: NourishSend = {
            fed: offer.pawns.length - preview.unfed,
            food: preview.food,
            wine: preview.wine
        }
        const left = offer.pawns.filter(({ n }) => feedOfPawn(n) === 'unfed')
        // R-4.10-H3 A feed stands while there is some of it to give.
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
                label: this.sendLabel(
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
        const room = NourishDraft.capacities(offer)
        const feeds = FeedOrder.filter((feed) => room[feed] > 0)
        return offer.pawns.map(({ n }) => {
            const feed = NourishDraft.feedOf(feeding, n)
            const next = feeds[(feeds.indexOf(feed) + 1) % feeds.length]
            return {
                target: pawnTarget(context.playerId, n),
                notes: [
                    feed === 'unfed'
                        ? { kind: 'threat' as const, label: 'home' }
                        : this.payChip(feed)
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

    /** R-4.10.1 "Feed 2 · 2 food", "Feed 2 · leave 1", "Leave the merchant". */
    private sendLabel({ fed, food, wine }: NourishSend, left: readonly GuildId[]): string {
        if (left.length === 0) {
            const paid = [
                ...(food > 0 ? [`${food} food`] : []),
                ...(wine > 0 ? [`${wine} wine`] : [])
            ]
            return [`Feed ${fed}`, ...paid].join(' · ')
        }
        if (fed > 0) {
            return `Feed ${fed} · leave ${left.length}`
        }
        return left.length === 1 ? `Leave the ${left[0]}` : `Leave ${left.length} pawns`
    }

    private payChip(feed: 'food' | 'wine'): ChipNote {
        return {
            kind: 'role',
            label: `1 ${feed}`,
            art: [{ kind: 'good', good: FeedArt[feed], count: 1 }]
        }
    }

    private static feedOf({ wineFed, unfed }: Feeding, n: PawnNumber): Feed {
        if (wineFed.includes(n)) {
            return 'wine'
        }
        return unfed.includes(n) ? 'unfed' : 'food'
    }

    private static feedingOf(
        pawns: readonly { readonly n: PawnNumber }[],
        feedFor: (n: PawnNumber) => Feed
    ): Feeding {
        const numbers = pawns.map(({ n }) => n)
        return {
            wineFed: numbers.filter((n) => feedFor(n) === 'wine'),
            unfed: numbers.filter((n) => feedFor(n) === 'unfed')
        }
    }

    private static capacities(offer: NourishOffer): Readonly<Record<Feed, number>> {
        return {
            food: offer.food,
            wine: offer.barrel,
            unfed: Math.max(0, offer.pawns.length - offer.food - offer.barrel)
        }
    }

    /** R-4.10.1 A full feed sends its last pawn back, so no pawn it could feed goes unfed. */
    private static feedingAfterPress(
        offer: NourishOffer,
        feeding: Feeding,
        n: PawnNumber,
        feed: Feed
    ): Feeding {
        const from = NourishDraft.feedOf(feeding, n)
        if (from === feed) {
            return feeding
        }
        const occupants = offer.pawns
            .map((pawn) => pawn.n)
            .filter((m) => NourishDraft.feedOf(feeding, m) === feed)
        const swapped =
            occupants.length >= NourishDraft.capacities(offer)[feed] ? occupants.at(-1) : undefined
        return NourishDraft.feedingOf(offer.pawns, (m) => {
            if (m === n) {
                return feed
            }
            return m === swapped ? from : NourishDraft.feedOf(feeding, m)
        })
    }
}

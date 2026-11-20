import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    ActionType,
    Feast,
    feastOffers,
    GuildAction,
    GuildById,
    guildActionOffers,
    GuildIds,
    nobleTradeOffer,
    alchemistTradeOffers,
    merchantTradeOffers,
    type CardPlayInput,
    type CompletionCount,
    type FeastOffer,
    type GuildActionOffer,
    type GuildFunctionName,
    type GuildId,
    type HydratedFeudumGameState,
    type MonsterId,
    type SpaceId
} from '@tabletop/feudum'
import {
    benchOffer,
    feastBenchSource,
    guildBenchSource,
    loneChoices,
    paymentTotal,
    type BenchOffer,
    type BenchPick,
    type BenchPresser,
    type BenchSeat,
    type BenchSource,
    type BenchStages
} from './benchOffer.js'
import {
    guildTarget,
    spaceTarget,
    type BoardTarget,
    type ChipNote,
    type PickTarget,
    type StagePick
} from './boardOffer.js'
import type { FlowPick, FlowPlay, FlowPopup, PanelChoice } from './cardFlows.js'
import { printedCost } from './cardModes.js'
import { sendsOnPress } from './confirmingSend.js'
import { StagedDraft, withLoneChoice } from './stagedDraft.svelte.js'
import type { TurnPrimary } from './turnDraft.svelte.js'

export type GuildDraftValues = {
    /** R-3.16 */
    guild: GuildId
    /** R-3.16.3 */
    feastSpace: SpaceId
    feastOf: { readonly opponentId: string; readonly guildId: GuildId }
    /** R-3.16.1 */
    fn: GuildFunctionName
    /** R-4.6.3 Farmer trade: the farm and how many rewards are food. */
    farm: SpaceId
    split: number
    /** R-4.6.3 Knight trade: the row is taken; the monster tamed, if any, and its space. */
    take: true
    monster: MonsterId | 'none'
    deploy: SpaceId
    /** R-4.6.1 Stacked: each press on the bench is one pick, in press order. */
    picks: readonly BenchPick[]
    /** R-4.10.2 */
    sulfur: number
    /** R-4.6.1 */
    count: CompletionCount
}

export const GuildStageOrder = [
    'guild',
    'feastSpace',
    'feastOf',
    'fn',
    'farm',
    'split',
    'take',
    'monster',
    'deploy',
    'picks',
    'sulfur',
    'count'
] as const satisfies readonly (keyof GuildDraftValues)[]
type MissingStages = Exclude<keyof GuildDraftValues, (typeof GuildStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export type GuildStageName = 'guild' | 'feast-space' | 'function' | 'opponent' | 'bench'

/** Present only while this seat's card is a guild function or a Feast: R-X.1. */
export interface GuildContext {
    readonly state: HydratedFeudumGameState
    readonly playerId: string
    readonly nameOf: (playerId: string) => string
    readonly mode: ActionType.GuildAction | ActionType.Feast
    /** R-3.3, R-3.15 What the card's play declares. */
    readonly input: CardPlayInput
    /** No auto stage led here, so a completing press may send. */
    readonly cardManual: boolean
}

export interface GuildPanel {
    readonly line: string
    readonly stage: GuildStageName
    readonly popup?: FlowPopup
    readonly bench?: BenchOffer
    readonly primary?: TurnPrimary
}

interface GuildView {
    readonly line: string
    readonly stage: GuildStageName
    readonly picks: readonly FlowPick[]
    readonly unlit: readonly PickTarget[]
    readonly picked: readonly BoardTarget[]
    readonly popup?: FlowPopup
    readonly bench?: BenchOffer
}

const CostFromPrices = (prices: readonly number[]): ChipNote | undefined =>
    prices.length > 0 ? { kind: 'cost', label: `from ${Math.min(...prices)}s` } : undefined

/**
 * R-3.16, R-3.16.3, R-4.6 One guild function or Feast, from its guild or space to its send. The rule
 * is in the logic package and the bench's reading of it in `benchOffer`; this holds the presses.
 */
export class GuildDraft extends StagedDraft<GuildDraftValues> {
    private readonly seeing: StagedSelectionState<GuildDraftValues> = $derived.by(() =>
        this.withLoneChoices(super.read())
    )

    constructor(private readonly contextOf: () => GuildContext | undefined) {
        super(GuildStageOrder)
    }

    /** R-X.1 Others and History View have no draft. Lone choices read through as `auto`. */
    protected override read(): StagedSelectionState<GuildDraftValues> {
        return this.seeing
    }

    private litGuilds(context: GuildContext): readonly GuildId[] {
        const offers = guildActionOffers(context.state, context.playerId)
        return GuildIds.filter((guildId) =>
            offers.some((offer) => offer.guildId === guildId && !offer.reason)
        )
    }

    private feastSpaces(offers: readonly FeastOffer[]): readonly SpaceId[] {
        return [...new Set(offers.filter(({ reason }) => !reason).map(({ spaceId }) => spaceId))]
    }

    private withLoneChoices(
        stored: StagedSelectionState<GuildDraftValues>
    ): StagedSelectionState<GuildDraftValues> {
        const context = this.contextOf()
        if (!context) {
            return {}
        }
        const first =
            context.mode === ActionType.GuildAction
                ? withLoneChoice<GuildDraftValues, 'guild'>(
                      stored,
                      GuildStageOrder,
                      'guild',
                      this.litGuilds(context)
                  )
                : withLoneChoice<GuildDraftValues, 'feastSpace'>(
                      stored,
                      GuildStageOrder,
                      'feastSpace',
                      this.feastSpaces(feastOffers(context.state, context.playerId, context.input))
                  )
        const source = this.sourceIn(context, first)
        return source ? this.withLoneBench(context, source, first) : first
    }

    /** Each stage in turn: a lone farm opens its split, a lone seal its send. */
    private withLoneBench(
        context: GuildContext,
        source: BenchSource,
        first: StagedSelectionState<GuildDraftValues>
    ): StagedSelectionState<GuildDraftValues> {
        const seat = this.seatOf(context)
        const stage = <TStage extends keyof GuildDraftValues>(
            stages: StagedSelectionState<GuildDraftValues>,
            name: TStage,
            value: GuildDraftValues[TStage] | undefined
        ) =>
            value === undefined
                ? stages
                : withLoneChoice<GuildDraftValues, TStage>(stages, GuildStageOrder, name, [value])
        const lone = (stages: StagedSelectionState<GuildDraftValues>) =>
            loneChoices(seat, source, this.benchStages(stages))
        const farm = stage(first, 'farm', lone(first).farm)
        const split = stage(farm, 'split', lone(farm).split)
        const deploy = stage(split, 'deploy', lone(split).deploy)
        const picks = stage(deploy, 'picks', lone(deploy).picks)
        return stage(picks, 'count', lone(picks).count)
    }

    private seatOf({ state, playerId, nameOf, input }: GuildContext): BenchSeat {
        return { state, playerId, nameOf, input }
    }

    private benchStages(stages: StagedSelectionState<GuildDraftValues>): BenchStages {
        const { farm, split, take, monster, deploy, picks, sulfur, count } = stages
        return {
            picks: picks?.value ?? [],
            ...(farm ? { farm: farm.value } : {}),
            ...(split ? { takeFood: split.value } : {}),
            ...(take ? { take: true } : {}),
            ...(monster ? { monster: monster.value } : {}),
            ...(deploy ? { deploy: deploy.value } : {}),
            ...(sulfur ? { sulfur: sulfur.value } : {}),
            ...(count ? { count: count.value } : {})
        }
    }

    /** The function on the bench, once its guild and function, or its Feast, are chosen. */
    private sourceIn(
        context: GuildContext,
        stages: StagedSelectionState<GuildDraftValues>
    ): BenchSource | undefined {
        const seat = this.seatOf(context)
        if (context.mode === ActionType.GuildAction) {
            const guild = stages.guild?.value
            const fn = stages.fn?.value
            return guild && fn ? guildBenchSource(seat, guild, fn) : undefined
        }
        const spaceId = stages.feastSpace?.value
        const feastOf = stages.feastOf?.value
        return spaceId && feastOf ? feastBenchSource(seat, { spaceId, ...feastOf }) : undefined
    }

    private readonly presser: BenchPresser = {
        picks: (picks) => {
            this.push('picks', picks)
        },
        take: () => {
            if (this.value('take')) {
                this.clearFrom('take')
            } else {
                this.set('take', true)
            }
        },
        monster: (monster) => {
            this.set('monster', monster)
        },
        deploy: (spaceId) => {
            this.set('deploy', spaceId)
        },
        farm: (spaceId) => {
            this.set('farm', spaceId)
        },
        split: (takeFood) => {
            this.set('split', takeFood)
        },
        sulfur: (toBarrel) => {
            this.set('sulfur', toBarrel)
        },
        count: (count) => {
            this.set('count', count)
        }
    }

    /** R-3.16, R-4.6.1 Each guild's lit or dimmed area. */
    /** Contract, Hover: what staging the function or the Feast would light. */
    lightsOpening(context: GuildContext): readonly BoardTarget[] {
        const { picks } =
            context.mode === ActionType.GuildAction
                ? this.guildView(context)
                : this.feastSpaceView(context)
        return picks.map(({ target }) => target)
    }

    private guildView(context: GuildContext): GuildView {
        const lit = this.litGuilds(context)
        return {
            line: 'Pick a guild',
            stage: 'guild',
            picks: lit.map((guildId): FlowPick => ({
                target: guildTarget(guildId),
                press: () => {
                    this.set('guild', guildId)
                }
            })),
            unlit: GuildIds.filter((guildId) => !lit.includes(guildId)).map((guildId) => ({
                target: guildTarget(guildId),
                unlit: true
            })),
            picked: []
        }
    }

    /** R-3.16.1 Trade, Pull, Push: each open one with its cost and best outcome. */
    private functionRow(context: GuildContext, offer: GuildActionOffer): PanelChoice {
        const { guildId, fn, bestVp } = offer
        const seat = this.seatOf(context)
        const name = `${fn.charAt(0).toUpperCase()}${fn.slice(1)}`
        const note =
            fn === 'trade'
                ? this.tradeCost(seat, guildId, guildBenchSource(seat, guildId, fn))
                : undefined
        return {
            label: bestVp > 0 ? `${name} · ${this.upToVp(bestVp)}` : name,
            picked: false,
            ...(note ? { note } : {}),
            press: () => {
                this.set('fn', fn)
            }
        }
    }

    private functionPopup(context: GuildContext, guildId: GuildId): GuildView {
        const offers = guildActionOffers(context.state, context.playerId)
        return {
            line: GuildById[guildId].name,
            stage: 'function',
            picks: [],
            unlit: [],
            picked: [guildTarget(guildId)],
            popup: {
                anchor: guildTarget(guildId),
                // Rule: a function the seat can't perform now is not drawn.
                choices: offers
                    .filter((offer) => offer.guildId === guildId && !offer.reason)
                    .map((offer) => this.functionRow(context, offer))
            }
        }
    }

    /** R-3.16.3 Spaces where a pawn eats with someone of rank. */
    private feastSpaceView(context: GuildContext): GuildView {
        const offers = feastOffers(context.state, context.playerId, context.input)
        const cost = printedCost('guild')
        const notes: readonly ChipNote[] = [
            { kind: 'cost', label: cost ? `feast · ${cost}` : 'feast' }
        ]
        return {
            line: 'Pick a space.',
            stage: 'feast-space',
            picks: this.feastSpaces(offers).map((spaceId): FlowPick => ({
                target: spaceTarget(spaceId),
                notes,
                press: () => {
                    this.set('feastSpace', spaceId)
                }
            })),
            unlit: [],
            picked: []
        }
    }

    /** R-3.16.3 Each opponent's own function there; one where nothing could move is not drawn. */
    private opponentPopup(context: GuildContext, spaceId: SpaceId): GuildView {
        const offers = feastOffers(context.state, context.playerId, context.input)
        return {
            line: 'Feast',
            stage: 'opponent',
            picks: [],
            unlit: [],
            picked: [spaceTarget(spaceId)],
            popup: {
                anchor: spaceTarget(spaceId),
                choices: offers
                    .filter((offer) => offer.spaceId === spaceId && !offer.reason)
                    .map(({ opponentId, guildId, fn, bestVp }): PanelChoice => ({
                        label: `${context.nameOf(opponentId)} · ${GuildById[guildId].name} ${fn}`,
                        note: { kind: 'gain', label: this.upToVp(bestVp) },
                        picked: false,
                        press: () => {
                            this.set('feastOf', { opponentId, guildId })
                        }
                    }))
            }
        }
    }

    private benchView(context: GuildContext, source: BenchSource): GuildView {
        const stages = this.selection
        const bench = benchOffer(
            this.seatOf(context),
            source,
            this.benchStages(stages),
            this.presser
        )
        const { feast } = source
        return {
            line: bench.collapsed ?? bench.line ?? bench.title,
            stage: 'bench',
            picks: bench.map ?? [],
            unlit: [],
            picked: [
                guildTarget(source.guildId),
                ...(feast ? [spaceTarget(feast.spaceId)] : []),
                ...(stages.farm ? [spaceTarget(stages.farm.value)] : []),
                ...(stages.deploy ? [spaceTarget(stages.deploy.value)] : [])
            ],
            ...(bench.popup ? { popup: bench.popup } : {}),
            bench
        }
    }

    private view: GuildView | undefined = $derived.by(() => {
        const context = this.contextOf()
        if (!context) {
            return undefined
        }
        const stages = this.selection
        const source = this.sourceIn(context, stages)
        if (source) {
            return this.benchView(context, source)
        }
        if (context.mode === ActionType.GuildAction) {
            const guild = stages.guild?.value
            return guild ? this.functionPopup(context, guild) : this.guildView(context)
        }
        const spaceId = stages.feastSpace?.value
        return spaceId ? this.opponentPopup(context, spaceId) : this.feastSpaceView(context)
    })

    /** Defined once the logic's refusal has passed: what a completing press or the primary sends. */
    play: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        const bench = this.view?.bench
        const stages = this.selection
        const source = context && this.sourceIn(context, stages)
        if (!context || !bench?.completes || !source) {
            return undefined
        }
        const { input } = context
        const { guildId, fn, feast } = source
        const { params, preview } = bench
        return {
            revealsInfo: preview?.revealsInfo === true,
            build: (maker) =>
                feast
                    ? maker.createPlayerAction(Feast, { ...input, ...feast, guildId, params })
                    : maker.createPlayerAction(GuildAction, { ...input, guildId, fn, params })
        }
    })

    /** R-X.2 A range ends on the primary; a function whose last press finishes it sends on it. */
    get sendsNow(): FlowPlay | undefined {
        const context = this.contextOf()
        const { play } = this
        return play && context?.cardManual && this.view?.bench?.fixed && sendsOnPress(this, play)
            ? play
            : undefined
    }

    panel: GuildPanel | undefined = $derived.by(() => {
        const { view } = this
        if (!view) {
            return undefined
        }
        const bench = view.bench
        const showsPrimary = bench && !view.popup && (!bench.fixed || this.play !== undefined)
        return {
            line: view.line,
            stage: view.stage,
            ...(view.popup ? { popup: view.popup } : {}),
            ...(bench ? { bench } : {}),
            ...(showsPrimary ? { primary: bench.primary } : {})
        }
    })

    /** What the board lights; only the seat whose card it is has one. */
    pick: StagePick | undefined = $derived.by(() => {
        const { view } = this
        return view
            ? {
                  targets: [
                      ...view.picks.map(({ target, notes }): PickTarget => ({
                          target,
                          ...(notes ? { notes } : {})
                      })),
                      ...view.unlit
                  ],
                  picked: view.picked
              }
            : undefined
    })

    /** A press outside an open popup does nothing (contract: Coexistence and precedence). */
    pickOf(target: BoardTarget): FlowPick | undefined {
        const { view } = this
        return view?.popup ? undefined : view?.picks.find((pick) => pick.target === target)
    }

    /** R-4.6.2 What a trade's row says in rose, before anything is picked. */
    private tradeCost(
        seat: BenchSeat,
        guildId: GuildId,
        source: BenchSource
    ): ChipNote | undefined {
        if (guildId === 'merchant') {
            return CostFromPrices(
                merchantTradeOffers(seat.state, seat.playerId).map(({ price }) => price)
            )
        }
        if (guildId === 'alchemist') {
            return CostFromPrices(alchemistTradeOffers(seat.state).map(({ price }) => price))
        }
        if (guildId === 'noble') {
            return { kind: 'cost', label: `${nobleTradeOffer(seat.state).price}s each` }
        }
        const { payment } = source.previewOf({}) ?? {}
        if (!payment) {
            return undefined
        }
        return { kind: 'cost', label: `${paymentTotal(payment)}s` }
    }

    private upToVp(bestVp: number): string {
        return `up to ${bestVp} vp`
    }
}

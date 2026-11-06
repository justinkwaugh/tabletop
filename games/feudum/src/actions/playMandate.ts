import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import type { Good, GuildId } from '../data/components.js'
import { MandateStatusStars, type MandateReward, type WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { reasonNoAtWillWindow, atWillWindow } from '../model/atWill.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange, statusStars } from '../model/guildStatus.js'
import { drawGoods } from '../model/haversack.js'
import {
    canCoverWithWildTiles,
    canPayGoods,
    canSpendWildTiles,
    goodsShort,
    payGoods,
    WildTileSpend,
    type GoodPrice
} from '../model/payments.js'
import { flipSeal, moveConcealedSeal } from '../model/seals.js'
import {
    ComponentCount,
    GoodSchema,
    GuildIdSchema,
    SealIdSchema,
    VesselTypeSchema,
    WritIdSchema
} from '../model/stateSchemas.js'
import { payShillingsFromSupply, takeInfluenceMarkers } from '../model/supply.js'
import { putWritsUnderInView } from '../model/writDeck.js'
import { writRegistry, type MandateAlternativeEffect } from '../writs/writRegistry.js'

/** R-4.4.2 What the seat received, as much of the reward as the supply had (R-1.1-H1). */
export type MandateReceived = Type.Static<typeof MandateReceived>
export const MandateReceived = Type.Union([
    Type.Object({ kind: Type.Literal('shillings'), amount: ComponentCount }),
    Type.Object({ kind: Type.Literal('goods'), goods: Type.Array(GoodSchema) }),
    Type.Object({ kind: Type.Literal('vessel'), vessel: VesselTypeSchema }),
    Type.Object({ kind: Type.Literal('influence'), amount: ComponentCount }),
    Type.Object({ kind: Type.Literal('seal'), amount: ComponentCount }),
    Type.Object({ kind: Type.Literal('bead'), sealIds: Type.Array(SealIdSchema) })
])

export type PlayMandateMetadata = Type.Static<typeof PlayMandateMetadata>
export const PlayMandateMetadata = Type.Object({
    /** R-4.4.2, R-5.1 The slot it took under the deck. */
    slot: ComponentCount,
    received: MandateReceived,
    /** R-4.5-H1, R-4.5-H3 Markers won may fill a rank the seat was owed. */
    rankChanges: Type.Optional(Type.Array(RankChange))
})

export type PlayMandate = Type.Static<typeof PlayMandate>
export const PlayMandate = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlayMandate),
            playerId: Type.String(),
            metadata: Type.Optional(PlayMandateMetadata),
            /** R-4.4.2 Public: a played writ is shown. */
            writId: WritIdSchema,
            /** R-4.4.2 The alternative's index; a guild-status mandate reads `rewardGuild`. */
            alternative: Type.Integer({ minimum: 0 }),
            /** R-4.4.2 The guild whose reward a guild-status mandate takes. */
            rewardGuild: Type.Optional(GuildIdSchema),
            /** R-4.3.3, R-4.4-H1 Tiles spent first, each for a good. */
            wildTiles: Type.Optional(Type.Array(WildTileSpend))
        })
    ])
)

export const PlayMandateValidator = Compile(PlayMandate)

export function isPlayMandate(action?: GameAction): action is PlayMandate {
    return action?.type === ActionType.PlayMandate
}

export interface PlayMandateInput {
    readonly writId: WritId
    readonly alternative: number
    readonly rewardGuild?: GuildId
    readonly wildTiles?: readonly WildTileSpend[]
}

/** R-7 What an alternative's turned-in goods come to. */
function priceOf(turnedIn: readonly Good[]): GoodPrice {
    const price: Partial<Record<Good, number>> = {}
    for (const good of turnedIn) {
        price[good] = (price[good] ?? 0) + 1
    }
    return price
}

/** R-4.4.2 Which of a held mandate's alternatives this is, from the seat's standing. */
function reasonEffectRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    effect: MandateAlternativeEffect,
    wildTiles: readonly WildTileSpend[]
): string | undefined {
    const { rewardGuild, turnedIn, reward } = effect
    if (rewardGuild && statusStars(state, playerId, rewardGuild) < MandateStatusStars) {
        return `You need ${MandateStatusStars} status stars in that guild.`
    }
    if (!canSpendWildTiles(state, playerId, wildTiles)) {
        return "You can't spend those region tiles."
    }
    if (!canPayGoods(state, playerId, priceOf(turnedIn), wildTiles)) {
        return `You can't turn in ${turnedIn.join(', ')}.`
    }
    return reward.kind === 'vessel' && state.supply.vessels[reward.vessel] === 0
        ? `The general supply has no ${reward.vessel.replaceAll('-', ' ')}.`
        : undefined
}

/**
 * R-4.4.2, R-4.4-H1, R-4.4-H7 In an at-will window, a writ held and an alternative it has; a guild's
 * reward only with 3 stars there; the goods paid, tiles first.
 */
export function reasonPlayMandateRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    { writId, alternative, rewardGuild, wildTiles = [] }: PlayMandateInput
): string | undefined {
    const closed = reasonNoAtWillWindow(state, playerId)
    if (closed) {
        return closed
    }
    if (!state.getPlayerState(playerId).requireWrits().includes(writId)) {
        return "You don't hold that writ."
    }
    const refused = writRegistry.reasonMandateRefused(writId, alternative, rewardGuild)
    if (refused) {
        return refused
    }
    const effect = writRegistry.mandateAlternative(writId, alternative, rewardGuild)
    return effect && reasonEffectRefused(state, playerId, effect, wildTiles)
}

/** R-4.4.2 One thing a held mandate can do. Dimmed with `refused` when not open now. */
export interface PlayMandateOffer {
    readonly writId: WritId
    readonly alternative: number
    readonly rewardGuild?: GuildId
    readonly turnedIn: readonly Good[]
    readonly reward: MandateReward
    /** R-X.2 Whether the press stages. */
    readonly revealsInfo: boolean
    /** R-4.3.3 The seat's goods fall short and its tiles can bring the rest. */
    readonly wildTileNeeded: boolean
    readonly refused?: string
}

/** R-4.3.3 How far a seat's own tiles could cover this alternative. */
function offerOf(
    state: HydratedFeudumGameState,
    playerId: string,
    writId: WritId,
    alternative: number,
    effect: MandateAlternativeEffect
): PlayMandateOffer {
    const price = priceOf(effect.turnedIn)
    const short = Object.values(goodsShort(state, playerId, price)).some((amount) => amount > 0)
    const wildTileNeeded = short && canCoverWithWildTiles(state, playerId, price)
    const wildTiles: WildTileSpend[] = []
    const refused = wildTileNeeded
        ? reasonEffectRefused(state, playerId, { ...effect, turnedIn: [] }, wildTiles)
        : reasonEffectRefused(state, playerId, effect, wildTiles)
    return {
        writId,
        alternative,
        ...(effect.rewardGuild ? { rewardGuild: effect.rewardGuild } : {}),
        turnedIn: effect.turnedIn,
        reward: effect.reward,
        revealsInfo: effect.reveals !== 'nothing',
        wildTileNeeded,
        ...(refused ? { refused } : {})
    }
}

/**
 * R-4.4.2, R-4.4-H1 Every alternative of every mandate this seat holds, in an at-will window. Read
 * from the seat's own projection; weapons have no alternatives here. Read-only.
 */
export function playMandateOffers(
    state: HydratedFeudumGameState,
    playerId: string
): PlayMandateOffer[] {
    if (!atWillWindow(state, playerId)) {
        return []
    }
    return (state.getPlayerState(playerId).writs ?? []).flatMap((writId) =>
        writRegistry
            .mandateAlternatives(writId)
            .map((effect, alternative) => offerOf(state, playerId, writId, alternative, effect))
    )
}

export class HydratedPlayMandate
    extends HydratableAction<typeof PlayMandate>
    implements PlayMandate
{
    declare type: ActionType.PlayMandate
    declare playerId: string
    declare metadata?: PlayMandateMetadata
    declare writId: WritId
    declare alternative: number
    declare rewardGuild?: GuildId
    declare wildTiles?: WildTileSpend[]

    constructor(data: PlayMandate) {
        super(data, PlayMandateValidator)
    }

    /** R-4.4.2 Turned in, then under the deck in view, then the reward; a barrier only if it shows. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonPlayMandateRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        const effect = writRegistry.mandateAlternative(
            this.writId,
            this.alternative,
            this.rewardGuild
        )
        if (!effect) {
            throw Error('R-4.4.2 The reason has found the alternative')
        }
        payGoods(state, this.playerId, priceOf(effect.turnedIn), this.wildTiles ?? [])

        const player = state.getPlayerState(this.playerId)
        const writs = player.requireWrits()
        writs.splice(writs.indexOf(this.writId), 1)
        player.writCount -= 1
        const slot = state.writDeck.nextBottom
        putWritsUnderInView(state, [this.writId])

        const received = this.takeReward(state, effect.reward)
        this.metadata = {
            slot,
            received,
            ...(received.kind === 'influence'
                ? { rankChanges: state.recomputeRanks(this.playerId) }
                : {})
        }
    }

    /** R-4.4.2, R-1.1-H1 What the reward resolves to sets the barrier, not what it could have. */
    private takeReward(state: HydratedFeudumGameState, reward: MandateReward): MandateReceived {
        const { playerId } = this
        const player = state.getPlayerState(playerId)
        switch (reward.kind) {
            case 'shillings':
                return {
                    kind: 'shillings',
                    amount: payShillingsFromSupply(state, playerId, reward.amount)
                }
            case 'goods': {
                const goods = drawGoods(state, reward.amount)
                for (const good of goods) {
                    player.goods[good] += 1
                }
                this.revealsInfo = goods.length > 0
                return { kind: 'goods', goods }
            }
            case 'vessel':
                state.supply.vessels[reward.vessel] -= 1
                player.vessels[reward.vessel] += 1
                return { kind: 'vessel', vessel: reward.vessel }
            case 'influence':
                return {
                    kind: 'influence',
                    amount: takeInfluenceMarkers(state, playerId, reward.amount)
                }
            case 'seal': {
                const amount = Math.min(reward.amount, state.supply.sealPileCount)
                for (let seal = 0; seal < amount; seal++) {
                    moveConcealedSeal(state, { kind: 'pile' }, { kind: 'held', playerId })
                }
                return { kind: 'seal', amount }
            }
            case 'bead': {
                const amount = Math.min(reward.amount, state.supply.sealPileCount)
                const sealIds = Array.from({ length: amount }, () =>
                    flipSeal(state, { kind: 'pile' }, { kind: 'player', playerId })
                )
                this.revealsInfo = sealIds.length > 0
                return { kind: 'bead', sealIds }
            }
            case 'attack':
                throw Error('R-4.4-H1 A weapon is used only through CommitAttack')
        }
    }
}

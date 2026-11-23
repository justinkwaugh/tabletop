import { goodCountsOf, goodsTotal } from '../model/collections.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { Spaces, type SpaceId } from '../data/board.js'
import { HarvestCardChart, type HarvestChartRow } from '../data/cards.js'
import { Goods, type Good } from '../data/components.js'
import { Seals } from '../data/seals.js'
import { ActionType } from '../definition/actions.js'
import { queueFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { drawGoods } from '../model/haversack.js'
import { beadToSeal } from '../model/seals.js'
import { ComponentCount, GoodCounts, SpaceIdSchema } from '../model/stateSchemas.js'
import {
    CardPlayFields,
    cardOf,
    playCard,
    reasonCardPlayRefused,
    reasonSpecialRefused,
    specialOffered,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'
import { locationKindOf } from '../model/locationDiscs.js'

/** R-3.11.1 */
const HarvestBaseGoods = 5
/** R-3.11.1 The most one harvest draws, and the goods at which a farm takes no more. */
const HarvestMostGoods = 10

/** R-3.11.1 All to the farm; R-3.11.2 favours decided before the draw; R-3.11.3 after it. */
export type HarvestMode = Type.Static<typeof HarvestMode>
export const HarvestMode = Type.Union([
    Type.Literal('plain'),
    Type.Literal('favours'),
    Type.Literal('inspect')
])

export type HarvestMetadata = Type.Static<typeof HarvestMetadata>
export const HarvestMetadata = Type.Object({
    /** R-3.11.1 What the seat's holdings yield; R-1.1-H1 `drawn` may come to less. */
    total: ComponentCount,
    /** R-5.2 Every good out of the haversack, by kind. */
    drawn: GoodCounts,
    vp: Type.Integer({ minimum: 0 }),
    /** R-3.11.2 To the seat's supply. Absent: favours weren't drawn in this Action. */
    favours: Type.Optional(GoodCounts),
    /** R-3.11.2 */
    beadsFlipped: ComponentCount
})

export type Harvest = Type.Static<typeof Harvest>
export const Harvest = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.Harvest),
            playerId: Type.String(),
            /** R-X.2, R-5.2 A haversack draw is always a barrier. */
            revealsInfo: Type.Literal(true),
            spaceId: SpaceIdSchema,
            mode: HarvestMode,
            metadata: Type.Optional(HarvestMetadata)
        })
    ])
)

export const HarvestValidator = Compile(Harvest)

export function isHarvest(action?: GameAction): action is Harvest {
    return action?.type === ActionType.Harvest
}

/** R-3.11.1 5 + 1 per other farm or feudum ruled + each held bead's value, at most 10. */
export function harvestTotal(state: HydratedFeudumGameState, playerId: string): number {
    const ruled = state.ruledSpaceIds(playerId).map((spaceId) => state.spaces[spaceId].location)
    const farms = ruled.filter((location) => locationKindOf(location) === 'farm').length
    const feudums = ruled.filter((location) => locationKindOf(location) === 'feudum').length
    const { beads } = state.getPlayerState(playerId)
    const beadValues = Seals.filter((seal) => beads.includes(seal.id)).reduce(
        (sum, seal) => sum + seal.beadValue,
        0
    )
    const others = Math.max(farms - 1, 0) + feudums
    return Math.min(HarvestBaseGoods + others + beadValues, HarvestMostGoods)
}

/** R-3.11.2 */
function chartRow(total: number): HarvestChartRow {
    const row = HarvestCardChart.find((candidate) => candidate.total === total)
    assertExists(row, `R-3.11.2 The chart has a total of ${total}`)
    return row
}

export interface HarvestInput extends CardPlayInput {
    readonly spaceId: SpaceId
    readonly mode: HarvestMode
}

/** R-3.11.1, R-3.11.3 A ruled farm under 10 goods; Inspect needs a Farmer pawn on the board. */
export function reasonHarvestRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: HarvestInput
): string | undefined {
    const refused =
        reasonCardPlayRefused(state, playerId, 'harvest', input) ??
        (input.mode === 'inspect' ? reasonSpecialRefused(state, playerId, 'harvest') : undefined)
    if (refused) {
        return refused
    }
    const space = state.spaces[input.spaceId]
    if (locationKindOf(space.location) !== 'farm') {
        return "That isn't a farm."
    }
    if (space.ruler?.playerId !== playerId) {
        return "You don't rule that farm."
    }
    return goodsTotal(state.spaces[input.spaceId].goods) >= HarvestMostGoods
        ? `That farm has ${HarvestMostGoods} goods: it takes no harvest until it drops below that.`
        : undefined
}

export interface HarvestFarmOffer {
    readonly spaceId: SpaceId
    readonly total: number
    readonly partial: number
    readonly favours: number
}

export interface HarvestOffers {
    readonly farms: readonly HarvestFarmOffer[]
    /** R-3.11.2 */
    readonly beads: number
    /** R-3.11.3 */
    readonly inspect: boolean
}

/** R-3.11 The goods are hidden until the draw, so there is no preview. */
export function harvestOffers(state: HydratedFeudumGameState, playerId: string): HarvestOffers {
    const total = harvestTotal(state, playerId)
    const { partial, favors } = chartRow(total)
    return {
        farms: Spaces.map(({ id }) => id)
            .filter(
                (spaceId) =>
                    locationKindOf(state.spaces[spaceId].location) === 'farm' &&
                    state.spaces[spaceId].ruler?.playerId === playerId &&
                    goodsTotal(state.spaces[spaceId].goods) < HarvestMostGoods
            )
            .map((spaceId) => ({ spaceId, total, partial, favours: favors })),
        beads: state.getPlayerState(playerId).beads.length,
        inspect: specialOffered(state, playerId, 'harvest')
    }
}

/** R-3.11.1, R-3.11.2 Favours flip every bead the seat holds into the vault. Returns how many. */
export function settleHarvest(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId,
    drawn: Readonly<GoodCounts>,
    favours?: Readonly<GoodCounts>
): number {
    const player = state.getPlayerState(playerId)
    const farm = state.spaces[spaceId].goods
    for (const good of Goods) {
        const taken = favours?.[good] ?? 0
        player.goods[good] += taken
        farm[good] += drawn[good] - taken
    }
    if (!favours) {
        return 0
    }
    const beads = [...player.beads]
    for (const sealId of beads) {
        beadToSeal(state, sealId, { kind: 'player', playerId }, { kind: 'held', playerId })
    }
    return beads.length
}

export class HydratedHarvest extends HydratableAction<typeof Harvest> implements Harvest {
    declare type: ActionType.Harvest
    declare playerId: string
    declare revealsInfo: true
    declare spaceId: SpaceId
    declare mode: HarvestMode
    declare metadata?: HarvestMetadata
    declare asRepeat?: RepeatMode
    declare secondCard?: true

    constructor(data: Harvest) {
        super(data, HarvestValidator)
    }

    /** R-3.11, R-5.2 */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonHarvestRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        const total = harvestTotal(state, this.playerId)
        const use = this.mode === 'inspect' ? 'special' : 'regular'
        playCard(state, this.playerId, 'harvest', use, this)

        const vp = HydratedHarvest.harvestVp()
        state.getPlayerState(this.playerId).score += vp

        const drawn = drawGoods(state, total)
        const owed = HydratedHarvest.favoursOwed(drawn, total)
        const drawnCounts = goodCountsOf(drawn)

        if (this.mode === 'inspect' && owed > 0) {
            // R-3.11.3 The goods wait in the open for the choice.
            state.flow.harvest = {
                spaceId: this.spaceId,
                drawn: { ...drawnCounts },
                favours: owed
            }
            queueFollowUp(state, { kind: 'inspect-harvest' })
            this.metadata = { total, drawn: drawnCounts, vp, beadsFlipped: 0 }
            return
        }
        // R-3.11-H1 Drawn at random: the partial, then the rest, unchosen.
        const favours =
            this.mode === 'favours' ? goodCountsOf(drawn.slice(drawn.length - owed)) : undefined
        // R-3.11-H2 No good left for a favour: none was taken, so no bead flips.
        const beadsFlipped = settleHarvest(
            state,
            this.playerId,
            this.spaceId,
            drawnCounts,
            owed > 0 ? favours : undefined
        )
        this.metadata = {
            total,
            drawn: drawnCounts,
            vp,
            ...(favours ? { favours } : {}),
            beadsFlipped
        }
    }

    /** R-3.11.1 */
    private static harvestVp(): number {
        const { vp } = cardOf('harvest')
        const points = vp === 'variable' ? undefined : vp?.at(0)
        assertExists(points, 'R-3.11.1 Harvest prints its vp')
        return points
    }

    /** R-3.11-H2 The farm fills first: only what is past the partial can be a favour. */
    private static favoursOwed(drawn: readonly Good[], total: number): number {
        return Math.max(drawn.length - chartRow(total).partial, 0)
    }
}

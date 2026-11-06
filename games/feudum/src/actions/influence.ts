import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assert,
    assertExists,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { Spaces, type SpaceId } from '../data/board.js'
import { ActionType } from '../definition/actions.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import { nextMarkerRole, placeMarker } from '../model/locationControl.js'
import { SpaceIdSchema } from '../model/stateSchemas.js'
import { payShillingsToSupply } from '../model/supply.js'
import {
    CardPlayFields,
    cardOf,
    playCard,
    reasonCardPlayRefused,
    reasonSpecialRefused,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'

/** R-4.1.2 One marker placed: the role it gave, and the ruler it dropped to serf. */
export type InfluencePlacement = Type.Static<typeof InfluencePlacement>
export const InfluencePlacement = Type.Object({
    spaceId: SpaceIdSchema,
    role: Type.Union([Type.Literal('ruler'), Type.Literal('serf'), Type.Literal('subject')]),
    displacedPlayerId: Type.Optional(Type.String())
})

export type InfluenceMetadata = Type.Static<typeof InfluenceMetadata>
export const InfluenceMetadata = Type.Object({
    /** R-3.8.2 */
    placements: Type.Array(InfluencePlacement),
    /** R-4.5.4 */
    rankChanges: Type.Array(RankChange)
})

export type Influence = Type.Static<typeof Influence>
export const Influence = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.Influence),
            playerId: Type.String(),
            metadata: Type.Optional(InfluenceMetadata),
            /** R-3.8-H1 Only when markers run short: exactly as many as the supply holds. */
            spaceIds: Type.Optional(Type.Array(SpaceIdSchema)),
            /** R-3.8.3 One merchant only. */
            moneyIsInfluence: Type.Optional(SpaceIdSchema)
        })
    ])
)

export const InfluenceValidator = Compile(Influence)

export function isInfluence(action?: GameAction): action is Influence {
    return action?.type === ActionType.Influence
}

export type InfluenceInput = CardPlayInput &
    Readonly<Pick<Influence, 'spaceIds' | 'moneyIsInfluence'>>

/** R-3.8.1, R-4.1.1 The spaces holding the seat's pawns that still take its marker. */
export function influenceSpaceIds(state: HydratedFeudumGameState, playerId: string): SpaceId[] {
    const stood = new Set(
        state.getPlayerState(playerId).pawns.flatMap((pawn) => pawn.spaceId ?? [])
    )
    return Spaces.map((space) => space.id).filter(
        (spaceId) =>
            stood.has(spaceId) && nextMarkerRole(state.spaces[spaceId], playerId) !== undefined
    )
}

/** R-3.8.1, R-1.1, R-3.8-H1 */
function reasonPlacementsRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceIds: readonly SpaceId[] | undefined
): string | undefined {
    const open = influenceSpaceIds(state, playerId)
    const markers = state.getPlayerState(playerId).influenceSupply
    if (open.length === 0) {
        return 'None of your pawns stands where a marker can go.'
    }
    if (markers === 0) {
        return 'You have no influence markers in your supply.'
    }
    if (open.length <= markers) {
        return spaceIds
            ? 'You have a marker for every space: there is nothing to choose.'
            : undefined
    }
    const place = `${markers} of ${open.length} spaces`
    if (!spaceIds) {
        return `Your markers run short: choose ${place}.`
    }
    return spaceIds.length === markers &&
        new Set(spaceIds).size === markers &&
        spaceIds.every((spaceId) => open.includes(spaceId))
        ? undefined
        : `Your markers run short: choose exactly ${place} holding your pawns.`
}

/** R-3.8.3 `placed` are the spaces this play puts markers on; a space's marker is the one paid. */
function reasonMoneyRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId,
    placed: readonly SpaceId[]
): string | undefined {
    const { ruler, serf } = state.spaces[spaceId]
    return (
        reasonSpecialRefused(state, playerId, 'influence', spaceId) ??
        (!ruler || ruler.playerId === playerId || ruler.subject
            ? "Money is Influence needs a space ruled by an opponent's single marker."
            : undefined) ??
        (serf && serf.playerId !== playerId
            ? "That space already holds two players' markers."
            : undefined) ??
        (placed.includes(spaceId) ? undefined : 'Money is Influence needs a marker going there.')
    )
}

/** R-3.8.1, R-3.8.3, R-4.1 */
export function reasonInfluenceRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: InfluenceInput
): string | undefined {
    const { spaceIds, moneyIsInfluence } = input
    return (
        reasonCardPlayRefused(state, playerId, 'influence', input) ??
        reasonPlacementsRefused(state, playerId, spaceIds) ??
        (moneyIsInfluence
            ? reasonMoneyRefused(
                  state,
                  playerId,
                  moneyIsInfluence,
                  spaceIds ?? influenceSpaceIds(state, playerId)
              )
            : undefined)
    )
}

/** R-3.8.3 What the card prints. */
function moneyPrice(): number {
    const need = cardOf('influence').special.needs.find((row) => row.kind === 'shillings')
    assert(need?.kind === 'shillings', 'R-3.8.3 Money is Influence prints its price')
    return need.shillings
}

/**
 * R-3.8.3 The lone ruler drops to serf and the seat's marker goes on top, though only tied. A seat
 * already the serf takes the space as R-4.1.2 does, its serf becoming the subject.
 */
function unseatLoneRuler(state: HydratedFeudumGameState, playerId: string, spaceId: SpaceId): void {
    payShillingsToSupply(state, playerId, moneyPrice())
    const space = state.spaces[spaceId]
    if (space.serf) {
        placeMarker(state, playerId, spaceId)
        return
    }
    assertExists(space.ruler, `R-3.8.3 ${spaceId} has a ruler`)
    state.getPlayerState(playerId).influenceSupply -= 1
    space.serf = { playerId: space.ruler.playerId }
    space.ruler = { playerId, subject: false }
}

function placeOne(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId,
    money: boolean
): InfluencePlacement {
    const before = state.spaces[spaceId].ruler?.playerId
    if (money) {
        unseatLoneRuler(state, playerId, spaceId)
        return { spaceId, role: 'ruler', ...(before ? { displacedPlayerId: before } : {}) }
    }
    const role = placeMarker(state, playerId, spaceId)
    return {
        spaceId,
        role,
        ...(role === 'ruler' && before ? { displacedPlayerId: before } : {})
    }
}

/** R-3.8.1, R-3.8-H1 Every marker goes down, then status recomputes once. */
function resolveInfluence(
    state: HydratedFeudumGameState,
    playerId: string,
    input: InfluenceInput
): InfluenceMetadata {
    const placed = input.spaceIds ?? influenceSpaceIds(state, playerId)
    const placements = placed.map((spaceId) =>
        placeOne(state, playerId, spaceId, spaceId === input.moneyIsInfluence)
    )
    return { placements, rankChanges: state.recomputeRanks(playerId) }
}

export interface InfluenceOffers {
    /** R-3.8.1 */
    readonly spaces: readonly SpaceId[]
    /** R-3.8-H1 How many markers go down: all the spaces, or all the markers when short. */
    readonly markers: number
    /** R-1.1 The seat must name `spaceIds`. */
    readonly short: boolean
    /** R-3.8.3 Not where the seat is already the serf: plain Influence takes that for nothing. */
    readonly moneyIsInfluence: readonly SpaceId[]
}

/** R-3.8.1, R-3.8.3, R-1.1 */
export function influenceOffers(state: HydratedFeudumGameState, playerId: string): InfluenceOffers {
    const spaces = influenceSpaceIds(state, playerId)
    const { influenceSupply } = state.getPlayerState(playerId)
    return {
        spaces,
        markers: Math.min(spaces.length, influenceSupply),
        short: influenceSupply > 0 && spaces.length > influenceSupply,
        moneyIsInfluence: spaces.filter(
            (spaceId) =>
                !state.spaces[spaceId].serf &&
                reasonMoneyRefused(state, playerId, spaceId, spaces) === undefined
        )
    }
}

/** R-3.8, R-4.5 The roles and ranks this input would give, by the real rule on a copy. */
export function influencePreview(
    state: HydratedFeudumGameState,
    playerId: string,
    input: InfluenceInput = {}
): InfluenceMetadata {
    return resolveInfluence(new HydratedFeudumGameState(state.dehydrate()), playerId, input)
}

export class HydratedInfluence extends HydratableAction<typeof Influence> implements Influence {
    declare type: ActionType.Influence
    declare playerId: string
    declare metadata?: InfluenceMetadata
    declare spaceIds?: SpaceId[]
    declare moneyIsInfluence?: SpaceId
    declare asRepeat?: RepeatMode
    declare secondCard?: true

    constructor(data: Influence) {
        super(data, InfluenceValidator)
    }

    /** R-3.8, R-4.1, R-4.5.4 */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonInfluenceRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        playCard(
            state,
            this.playerId,
            'influence',
            this.moneyIsInfluence ? 'special' : 'regular',
            this
        )
        this.metadata = resolveInfluence(state, this.playerId, this)
    }
}

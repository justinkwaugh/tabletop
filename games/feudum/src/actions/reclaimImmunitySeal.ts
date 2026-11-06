import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Spaces, type SpaceId } from '../data/board.js'
import { ActionType } from '../definition/actions.js'
import { StarveRole } from '../model/flow.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { moveConcealedSeal } from '../model/seals.js'
import { SpaceIdSchema } from '../model/stateSchemas.js'
import { markerImmune, markerPlayerId, StarveRoles } from './starve.js'

export type ReclaimImmunitySeal = Type.Static<typeof ReclaimImmunitySeal>
export const ReclaimImmunitySeal = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ReclaimImmunitySeal),
            playerId: Type.String(),
            spaceId: SpaceIdSchema,
            role: StarveRole
        })
    ])
)

export const ReclaimImmunitySealValidator = Compile(ReclaimImmunitySeal)

export function isReclaimImmunitySeal(action?: GameAction): action is ReclaimImmunitySeal {
    return action?.type === ActionType.ReclaimImmunitySeal
}

function sealUnderOwnMarker(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId,
    role: StarveRole
): boolean {
    const space = state.spaces[spaceId]
    return markerPlayerId(space, role) === playerId && markerImmune(space, role)
}

/** R-3.14.2, R-3.14-H2 The seat being asked, and a seal under a marker of its own. */
export function reasonReclaimImmunitySealRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId,
    role: StarveRole
): string | undefined {
    if (!state.isActivePlayer(playerId)) {
        return "It isn't your turn."
    }
    return sealUnderOwnMarker(state, playerId, spaceId, role)
        ? undefined
        : 'No seal lies under a marker of yours there.'
}

/** R-3.14.2 A seal this seat could take back. */
export interface ReclaimImmunitySealOffer {
    readonly spaceId: SpaceId
    readonly role: StarveRole
}

/** R-3.14-H2 The seat's immune markers, from public occupancy. Read-only. */
export function reclaimImmunitySealOffers(
    state: HydratedFeudumGameState,
    playerId: string
): ReclaimImmunitySealOffer[] {
    return Spaces.flatMap(({ id: spaceId }) =>
        StarveRoles.flatMap((role): ReclaimImmunitySealOffer[] =>
            reasonReclaimImmunitySealRefused(state, playerId, spaceId, role)
                ? []
                : [{ spaceId, role }]
        )
    )
}

export class HydratedReclaimImmunitySeal
    extends HydratableAction<typeof ReclaimImmunitySeal>
    implements ReclaimImmunitySeal
{
    declare type: ActionType.ReclaimImmunitySeal
    declare playerId: string
    declare spaceId: SpaceId
    declare role: StarveRole

    constructor(data: ReclaimImmunitySeal) {
        super(data, ReclaimImmunitySealValidator)
    }

    /** R-3.14.2 The seal goes to the seat unseen, and the marker can be starved again. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const refused = reasonReclaimImmunitySealRefused(
            state,
            this.playerId,
            this.spaceId,
            this.role
        )
        if (refused) {
            throw Error(refused)
        }
        moveConcealedSeal(
            state,
            { kind: 'immunity', spaceId: this.spaceId, role: this.role },
            { kind: 'held', playerId: this.playerId }
        )
    }
}

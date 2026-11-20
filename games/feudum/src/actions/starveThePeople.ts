import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Spaces, type SpaceId } from '../data/board.js'
import { ActionType } from '../definition/actions.js'
import { markRevealsInfo } from '../definition/revealing.js'
import { StarveRole } from '../model/flow.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { chickenBeads } from '../model/guildsState.js'
import { SpaceIdSchema } from '../model/stateSchemas.js'
import {
    CardPlayFields,
    playCard,
    reasonCardPlayRefused,
    reasonSpecialRefused,
    type CardPlayInput
} from './cardPlay.js'
import {
    markerImmune,
    markerPlayerId,
    resolveStarve,
    starveAsks,
    StarveRecord,
    StarveRoles
} from './starve.js'

export type StarveThePeopleMetadata = Type.Static<typeof StarveThePeopleMetadata>
export const StarveThePeopleMetadata = Type.Object({
    /** R-3.14-H1 */
    asked: Type.Boolean(),
    /** R-3.13.2 Present when nobody was asked and the Starve resolved here. */
    starved: Type.Optional(StarveRecord)
})

export type StarveThePeople = Type.Static<typeof StarveThePeople>
export const StarveThePeople = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.StarveThePeople),
            playerId: Type.String(),
            spaceId: SpaceIdSchema,
            targetPlayerId: Type.String(),
            role: StarveRole,
            metadata: Type.Optional(StarveThePeopleMetadata)
        })
    ])
)

export const StarveThePeopleValidator = Compile(StarveThePeople)

export function isStarveThePeople(action?: GameAction): action is StarveThePeople {
    return action?.type === ActionType.StarveThePeople
}

export interface StarveThePeopleInput extends CardPlayInput {
    readonly spaceId: SpaceId
    readonly targetPlayerId: string
    readonly role: StarveRole
}

/** R-3.13.2, R-3.14.2 An opponent's subject or serf on the space, with no seal under it. */
function reasonMarkerRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    { spaceId, targetPlayerId, role }: StarveThePeopleInput
): string | undefined {
    if (targetPlayerId === playerId) {
        return 'That marker is yours.'
    }
    const space = state.spaces[spaceId]
    if (markerPlayerId(space, role) !== targetPlayerId) {
        return `That seat has no ${role} there.`
    }
    return markerImmune(space, role) ? 'A seal lies under that marker.' : undefined
}

/** R-3.13.2, R-3.13-H1, R-3.14.2 */
export function reasonStarveThePeopleRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: StarveThePeopleInput
): string | undefined {
    return (
        reasonCardPlayRefused(state, playerId, 'conquer', input) ??
        reasonSpecialRefused(state, playerId, 'conquer', input.spaceId) ??
        reasonMarkerRefused(state, playerId, input)
    )
}

/** R-3.13.2 A legal Starve, and what the table can already tell about it. */
export interface StarveOffer {
    readonly spaceId: SpaceId
    readonly targetPlayerId: string
    readonly role: StarveRole
    /** R-3.14-H1 Whether the Starve would ask, and so be a barrier. */
    readonly revealsInfo: boolean
    /** R-3.13.2 How many chicken beads would go to the pile. */
    readonly beads: number
}

/** R-3.13.2 Each subject and serf the seat could starve now. Read-only. */
export function starveOffers(
    state: HydratedFeudumGameState,
    playerId: string,
    input: CardPlayInput = {}
): StarveOffer[] {
    const beads = chickenBeads(state.guilds.farmer).length
    return Spaces.flatMap(({ id: spaceId }) =>
        StarveRoles.flatMap((role): StarveOffer[] => {
            const targetPlayerId = markerPlayerId(state.spaces[spaceId], role)
            if (
                !targetPlayerId ||
                reasonStarveThePeopleRefused(state, playerId, {
                    ...input,
                    spaceId,
                    targetPlayerId,
                    role
                })
            ) {
                return []
            }
            return [
                {
                    spaceId,
                    targetPlayerId,
                    role,
                    revealsInfo: starveAsks(state, targetPlayerId),
                    beads
                }
            ]
        })
    )
}

export class HydratedStarveThePeople
    extends HydratableAction<typeof StarveThePeople>
    implements StarveThePeople
{
    declare type: ActionType.StarveThePeople
    declare playerId: string
    declare spaceId: SpaceId
    declare targetPlayerId: string
    declare role: StarveRole
    declare asRepeat?: StarveThePeople['asRepeat']
    declare secondCard?: StarveThePeople['secondCard']
    declare metadata?: StarveThePeopleMetadata

    constructor(data: StarveThePeople) {
        super(data, StarveThePeopleValidator)
    }

    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const refused = reasonStarveThePeopleRefused(state, this.playerId, this)
        if (refused) {
            throw Error(refused)
        }
        playCard(state, this.playerId, 'conquer', 'special', this)
        const target = {
            actorId: this.playerId,
            targetPlayerId: this.targetPlayerId,
            spaceId: this.spaceId,
            role: this.role
        }
        if (starveAsks(state, this.targetPlayerId)) {
            state.flow.starve = target
            // R-X.2 The prompt asks a hidden hand, whatever the answer.
            markRevealsInfo(this, true)
            this.metadata = { asked: true }
            return
        }
        this.metadata = { asked: false, starved: resolveStarve(state, target) }
    }
}

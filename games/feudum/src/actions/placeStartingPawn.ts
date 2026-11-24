import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { Spaces, type SpaceId } from '../data/board.js'
import { GuildIds, type Character } from '../data/components.js'
import type { GuildRank } from '../data/guilds.js'
import { ActionType } from '../definition/actions.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { rankOf, RankChange } from '../model/guildStatus.js'
import { GuildIdSchema, SpaceIdSchema } from '../model/stateSchemas.js'

/** R-1.4.9 */
export const StartingSpaceIds: readonly SpaceId[] = Spaces.filter(
    (space) => space.startingSpace
).map((space) => space.id)

export type PlaceStartingPawnMetadata = Type.Static<typeof PlaceStartingPawnMetadata>
export const PlaceStartingPawnMetadata = Type.Object({
    /** R-4.5 What the recompute did, so the rank taken. */
    rankChanges: Type.Array(RankChange)
})

export type PlaceStartingPawn = Type.Static<typeof PlaceStartingPawn>
export const PlaceStartingPawn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceStartingPawn),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceStartingPawnMetadata),
            character: GuildIdSchema,
            spaceId: SpaceIdSchema
        })
    ])
)

export const PlaceStartingPawnValidator = Compile(PlaceStartingPawn)

export function isPlaceStartingPawn(action?: GameAction): action is PlaceStartingPawn {
    return action?.type === ActionType.PlaceStartingPawn
}

/** R-1.4.9 Any starting space; several seats may share one. */
export function reasonStartingPawnRefused(spaceId: SpaceId): string | undefined {
    return StartingSpaceIds.includes(spaceId) ? undefined : `${spaceId} is not a starting space.`
}

/** R-1.4.9 Turns the seat's first pawn off the board to the character. */
function standPawn(
    state: HydratedFeudumGameState,
    playerId: string,
    character: Character,
    spaceId: SpaceId
): void {
    const pawn = state.getPlayerState(playerId).pawns.find((candidate) => !candidate.spaceId)
    assertExists(pawn, `R-1.4.9 ${playerId} has no pawn off the board`)
    pawn.character = character
    pawn.spaceId = spaceId
}

export interface StartingPawnOffers {
    readonly spaces: readonly SpaceId[]
    /** R-4.5 The rank each character would give now; absent: no rank. */
    readonly characters: readonly { readonly character: Character; readonly rank?: GuildRank }[]
}

/** R-1.4.9, R-4.5-H1 The rank runs the real recompute on a copy of the table. */
export function startingPawnOffers(
    state: HydratedFeudumGameState,
    playerId: string
): StartingPawnOffers {
    const characters = GuildIds.map((character) => {
        const trial = new HydratedFeudumGameState(state.dehydrate())
        standPawn(trial, playerId, character, StartingSpaceIds[0])
        trial.recomputeRanks(playerId)
        const rank = rankOf(trial.guilds.tracks[character], playerId)
        return { character, ...(rank ? { rank } : {}) }
    })
    return { spaces: StartingSpaceIds, characters }
}

export class HydratedPlaceStartingPawn
    extends HydratableAction<typeof PlaceStartingPawn>
    implements PlaceStartingPawn
{
    declare type: ActionType.PlaceStartingPawn
    declare playerId: string
    declare metadata?: PlaceStartingPawnMetadata
    declare character: Character
    declare spaceId: SpaceId

    constructor(data: PlaceStartingPawn) {
        super(data, PlaceStartingPawnValidator)
    }

    /** R-1.4.9, R-4.5-H1 Equal stars, and holders kept on a tie, give the printed order. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonStartingPawnRefused(this.spaceId)
        if (reason) {
            throw Error(reason)
        }
        standPawn(state, this.playerId, this.character, this.spaceId)
        this.metadata = { rankChanges: state.recomputeRanks(this.playerId) }
    }
}

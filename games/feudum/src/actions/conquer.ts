import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Spaces, type SpaceId } from '../data/board.js'
import { MonsterIds } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { CombatTarget } from '../model/flow.js'
import type { CombatStrength } from '../model/combatStrength.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { GuildIdSchema, SpaceIdSchema } from '../model/stateSchemas.js'
import { CardPlayFields, playCard, reasonCardPlayRefused, type CardPlayInput } from './cardPlay.js'
import {
    attackerMayAdd,
    CombatRecord,
    conquerVp,
    defenderAsked,
    resolveCombat,
    strengthOf
} from './combat.js'

export type ConquerMetadata = Type.Static<typeof ConquerMetadata>
export const ConquerMetadata = Type.Object({
    /** R-3.13.1 Whose piece it is: the target may name a space's feudum only. */
    defenderId: Type.String(),
    /** R-3.13.1 The character a pawn target shows, for the sentence. */
    character: Type.Optional(GuildIdSchema),
    /** R-3.14-H1 */
    asked: Type.Boolean(),
    /** R-4.8-H5 Present when nothing is left to ask and the combat resolved here. */
    combat: Type.Optional(CombatRecord)
})

export type Conquer = Type.Static<typeof Conquer>
export const Conquer = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.Conquer),
            playerId: Type.String(),
            spaceId: SpaceIdSchema,
            target: CombatTarget,
            metadata: Type.Optional(ConquerMetadata)
        })
    ])
)

export const ConquerValidator = Compile(Conquer)

export function isConquer(action?: GameAction): action is Conquer {
    return action?.type === ActionType.Conquer
}

export interface ConquerInput extends CardPlayInput {
    readonly spaceId: SpaceId
    readonly target: CombatTarget
}

/** R-3.13.1 The seat has a pawn or monster on the space. */
function seatPresent(state: HydratedFeudumGameState, playerId: string, spaceId: SpaceId): boolean {
    return (
        state.getPlayerState(playerId).pawns.some((pawn) => pawn.spaceId === spaceId) ||
        MonsterIds.some((monster) => {
            const { playerId: holder, spaceId: standsOn } = state.monsters[monster]
            return holder === playerId && standsOn === spaceId
        })
    )
}

/** R-3.13.1 Who defends the target: its player, or a feudum's ruler. */
function defenderOf(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    target: CombatTarget
): string | undefined {
    switch (target.kind) {
        case 'pawn':
            return target.playerId
        case 'monster':
            return state.monsters[target.monsterId].playerId
        case 'feudum':
            return state.spaces[spaceId].ruler?.playerId
    }
}

/** R-3.13.1 An opponent's pawn, monster or feudum; never an outpost, farm or town. */
function reasonTargetRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId,
    target: CombatTarget
): string | undefined {
    switch (target.kind) {
        case 'pawn': {
            if (target.playerId === playerId) {
                return 'That piece is yours.'
            }
            const stands = state
                .getPlayerState(target.playerId)
                .pawns.some((pawn) => pawn.n === target.n && pawn.spaceId === spaceId)
            return stands ? undefined : "That pawn isn't on that space."
        }
        case 'monster': {
            const { playerId: holder, spaceId: standsOn } = state.monsters[target.monsterId]
            if (!holder || standsOn !== spaceId) {
                return "That monster isn't on that space."
            }
            return holder === playerId ? 'That piece is yours.' : undefined
        }
        case 'feudum': {
            const { location, ruler } = state.spaces[spaceId]
            if (location.kind !== 'feudum') {
                return "That location isn't a feudum: outposts, farms and towns are never targets."
            }
            if (!ruler) {
                return 'Nobody rules that feudum.'
            }
            return ruler.playerId === playerId ? 'That feudum is yours.' : undefined
        }
    }
}

/** R-3.13.1, R-3.13-H1 */
export function reasonConquerRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: ConquerInput
): string | undefined {
    const { spaceId, target } = input
    return (
        reasonCardPlayRefused(state, playerId, 'conquer', input) ??
        (seatPresent(state, playerId, spaceId)
            ? reasonTargetRefused(state, playerId, spaceId, target)
            : 'You have no pawn or monster on that space.')
    )
}

/** R-3.13.1 A legal Conquer, and what the table can already tell about it (S32). */
export interface ConquerOffer {
    readonly spaceId: SpaceId
    readonly target: CombatTarget
    readonly defenderId: string
    /** R-3.14-H1 Whether the Conquer would ask, and so be a barrier. */
    readonly revealsInfo: boolean
    /** R-4.8.2 As things stand: nothing added, no Defend flipped. */
    readonly strength: CombatStrength
    /** R-3.13.1 If it wins. */
    readonly vp: number
}

/** R-3.13.1 Each piece and feudum the seat could conquer now. Read-only. */
export function conquerOffers(
    state: HydratedFeudumGameState,
    playerId: string,
    input: CardPlayInput = {}
): ConquerOffer[] {
    return Spaces.flatMap(({ id: spaceId }) => {
        if (!seatPresent(state, playerId, spaceId)) {
            return []
        }
        const targets: CombatTarget[] = [
            ...state.players.flatMap((player) =>
                player.pawns
                    .filter((pawn) => pawn.spaceId === spaceId)
                    .map((pawn): CombatTarget => ({
                        kind: 'pawn',
                        playerId: player.playerId,
                        n: pawn.n
                    }))
            ),
            ...MonsterIds.map((monsterId): CombatTarget => ({ kind: 'monster', monsterId })),
            { kind: 'feudum' }
        ]
        return targets.flatMap((target): ConquerOffer[] => {
            if (reasonConquerRefused(state, playerId, { ...input, spaceId, target })) {
                return []
            }
            const defenderId = defenderOf(state, spaceId, target)
            assertExists(defenderId, 'R-3.13.1 A legal target has a defender')
            return [
                {
                    spaceId,
                    target,
                    defenderId,
                    revealsInfo: defenderAsked(state, defenderId),
                    strength: strengthOf(
                        state,
                        {
                            attackerId: playerId,
                            defenderId,
                            spaceId,
                            target,
                            defendFlipped: false
                        },
                        0,
                        0
                    ),
                    vp: conquerVp(target)
                }
            ]
        })
    })
}

export class HydratedConquer extends HydratableAction<typeof Conquer> implements Conquer {
    declare type: ActionType.Conquer
    declare playerId: string
    declare spaceId: SpaceId
    declare target: CombatTarget
    declare asRepeat?: Conquer['asRepeat']
    declare secondCard?: Conquer['secondCard']
    declare metadata?: ConquerMetadata

    constructor(data: Conquer) {
        super(data, ConquerValidator)
    }

    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const refused = reasonConquerRefused(state, this.playerId, this)
        if (refused) {
            throw Error(refused)
        }
        const defenderId = defenderOf(state, this.spaceId, this.target)
        assertExists(defenderId, 'R-3.13.1 A legal target has a defender')
        const { target } = this
        const character =
            target.kind === 'pawn'
                ? state.getPlayerState(target.playerId).pawns.find((pawn) => pawn.n === target.n)
                      ?.character
                : undefined
        playCard(state, this.playerId, 'conquer', 'regular', this)
        state.flow.combat = {
            attackerId: this.playerId,
            defenderId,
            spaceId: this.spaceId,
            target: this.target,
            defendFlipped: false
        }
        const asked = defenderAsked(state, defenderId)
        if (asked) {
            // R-X.2 The prompt asks a hidden hand, whatever the answer.
            this.revealsInfo = true
        }
        const combat =
            asked || attackerMayAdd(state, this.playerId) ? undefined : resolveCombat(state, 0, 0)
        this.metadata = {
            defenderId,
            ...(character ? { character } : {}),
            asked,
            ...(combat ? { combat } : {})
        }
    }
}

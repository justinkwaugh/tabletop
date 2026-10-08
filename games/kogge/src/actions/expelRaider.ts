import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export type ExpelRaider = Type.Static<typeof ExpelRaider>
export const ExpelRaider = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ExpelRaider),
            playerId: Type.String(),
            slot: Type.Optional(Type.Integer({ minimum: 0, maximum: 1 })),
            metadata: Type.Optional(
                Type.Object({
                    raiderId: Type.String(),
                    from: Type.Integer({ minimum: 0 }),
                    destination: Type.Optional(Type.Integer({ minimum: 0 })),
                    revealed: Type.Boolean(),
                    blocked: Type.Boolean()
                })
            )
        })
    ])
)

export const ExpelRaiderValidator = Compile(ExpelRaider)

export function isExpelRaider(action?: GameAction): action is ExpelRaider {
    return action?.type === ActionType.ExpelRaider
}

// Rulebook 3f: the robber's cog is moved one space for free along the city's routes, as
// the other players choose; designer ruling (BGG thread 87074): face-down routes count.
export class HydratedExpelRaider
    extends HydratableAction<typeof ExpelRaider>
    implements ExpelRaider
{
    declare type: ActionType.ExpelRaider
    declare playerId: string
    declare slot?: number
    declare metadata?: {
        raiderId: string
        from: number
        destination?: number
        revealed: boolean
        blocked: boolean
    }

    constructor(data: ExpelRaider) {
        super(data, ExpelRaiderValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        const raid = state.raid
        assertExists(raid, 'No raid in progress')
        if (raid.expellerId !== this.playerId) {
            throw Error('Invalid ExpelRaider action')
        }
        const raider = state.getPlayerState(raid.raiderId)
        const from = raider.location()
        if (this.slot === undefined) {
            if (state.expulsionRoutes(raid.raiderId).length > 0) {
                throw Error('The robber must be moved along an open route')
            }
            this.metadata = { raiderId: raid.raiderId, from, revealed: false, blocked: true }
            return
        }
        if (!state.expulsionRoutes(raid.raiderId).includes(this.slot)) {
            throw Error('Invalid expulsion route')
        }
        const revealed = state.city(from).routes[this.slot].hidden !== undefined
        const destination = state.followRoute(from, this.slot)
        const blocked = state.isBanned(raid.raiderId, destination)
        if (!blocked) {
            raider.city = destination
        }
        if (revealed) {
            this.revealsInfo = true
        }
        this.metadata = { raiderId: raid.raiderId, from, destination, revealed, blocked }
    }
}

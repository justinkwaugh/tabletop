import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { SailRoute, SailRouteKind, type HydratedKoggeGameState } from '../model/gameState.js'
import { Payment } from '../model/payment.js'

export type Sail = Type.Static<typeof Sail>
export const Sail = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Sail),
            playerId: Type.String(),
            route: SailRoute,
            payment: Payment,
            metadata: Type.Optional(
                Type.Object({
                    from: Type.Integer({ minimum: 0 }),
                    destination: Type.Integer({ minimum: 0 }),
                    revealed: Type.Boolean(),
                    blocked: Type.Boolean(),
                    collected: Type.Integer({ minimum: 0 })
                })
            )
        })
    ])
)

export const SailValidator = Compile(Sail)

export function isSail(action?: GameAction): action is Sail {
    return action?.type === ActionType.Sail
}

export class HydratedSail extends HydratableAction<typeof Sail> implements Sail {
    declare type: ActionType.Sail
    declare playerId: string
    declare route: SailRoute
    declare payment: Payment
    declare metadata?: {
        from: number
        destination: number
        revealed: boolean
        blocked: boolean
        collected: number
    }

    constructor(data: Sail) {
        super(data, SailValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        const option = state.sailOption(this.playerId, this.route)
        assertExists(option, 'Invalid Sail action')
        if (!state.isValidPayment(this.playerId, this.payment, option.cost)) {
            throw Error('Invalid Sail payment')
        }
        const player = state.getPlayerState(this.playerId)
        const turn = state.activeTurn(this.playerId)
        const from = player.location()
        state.pay(player, this.payment)
        turn.moves += 1
        const destination =
            this.route.kind === SailRouteKind.Route
                ? state.followRoute(from, this.route.slot)
                : state.guildMaster.city
        // German rulebook v1.1: a revealed marker leading into one's own raided city ends
        // the movement where the cog stands; the fee is lost.
        const blocked = state.isBlockedDestination(this.playerId, destination)
        let collected = 0
        if (blocked) {
            turn.movementDone = true
        } else {
            player.city = destination
            collected = state.collectOfficeGoods(player)
        }
        if (option.hidden) {
            this.revealsInfo = true
        }
        this.metadata = { from, destination, revealed: option.hidden, blocked, collected }
    }

    static canSail(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.sailOptions(playerId).length > 0
    }
}

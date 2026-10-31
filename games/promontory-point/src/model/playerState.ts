import { Color, Hydratable, PlayerState, Visibility, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { RailroadId } from '../components/railroads.js'
import { SHARES_PER_RAILROAD } from '../components/shares.js'
import { PerRailroad, RailroadIdSchema } from './schemas.js'

export type PromontoryPointPlayerState = Type.Static<typeof PromontoryPointPlayerState>
export const PromontoryPointPlayerState = Type.Object({
    ...PlayerState.properties,
    // R-1.1-H2, R-1.3-H1: an uncapped number, public.
    money: Type.Integer({ minimum: 0 }),
    shares: PerRailroad(Type.Integer({ minimum: 0, maximum: SHARES_PER_RAILROAD })),
    // R-1.3 step 6, R-5
    hand: Visibility.protect(Type.Array(RailroadIdSchema), {
        policy: Visibility.Policy.Owner
    }),
    handCount: Type.Integer({ minimum: 0 }),
    // R-6.3, R-6.3-H2: face up, since the table saw it revealed.
    keptPiece: Type.Optional(RailroadIdSchema)
})

export const PromontoryPointPlayerStateValidator = Compile(PromontoryPointPlayerState)

export const PromontoryPointProjectedPlayerState = Visibility.createProjectionSchema(
    PromontoryPointPlayerState
)
export type PromontoryPointProjectedPlayerState = Type.Static<
    typeof PromontoryPointProjectedPlayerState
>
const PromontoryPointProjectedPlayerStateValidator = Compile(PromontoryPointProjectedPlayerState)

// R-1.3 step 4: one railroad's shares across every seat.
export function sharesHeld(
    players: readonly Pick<PromontoryPointPlayerState, 'shares'>[],
    railroadId: RailroadId
): number {
    return players.reduce((held, player) => held + player.shares[railroadId], 0)
}

export class HydratedPromontoryPointPlayerState
    extends Hydratable<typeof PromontoryPointProjectedPlayerState>
    implements PromontoryPointProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare money: number
    declare shares: Record<RailroadId, number>
    declare hand?: RailroadId[]
    declare handCount: number
    declare keptPiece?: RailroadId

    constructor(data: PromontoryPointProjectedPlayerState) {
        super(data, PromontoryPointProjectedPlayerStateValidator)
    }

    knownHand(): RailroadId[] {
        assertExists(this.hand, 'This operation requires a known hand')
        return this.hand
    }
}

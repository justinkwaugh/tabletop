import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import { payShillingsFromSupply } from '../model/supply.js'
import {
    CardPlayFields,
    playCard,
    reasonCardPlayRefused,
    specialOffered,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'

/** R-3.12.1 */
const TaxBaseShillings = 2

export type TaxMetadata = Type.Static<typeof TaxMetadata>
export const TaxMetadata = Type.Object({
    /** R-3.12.1, R-1.1-H1 What the supply paid. */
    shillings: Type.Integer({ minimum: 0 }),
    /** R-3.12.2 Where the marker came from; absent: none was taken. */
    reinforcements: Type.Optional(
        Type.Union([Type.Literal('general-supply'), Type.Literal('knight-row')])
    ),
    /** R-4.5.2 A marker in hand may go straight onto a track the seat qualifies for. */
    rankChanges: Type.Array(RankChange)
})

export type Tax = Type.Static<typeof Tax>
export const Tax = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.Tax),
            playerId: Type.String(),
            metadata: Type.Optional(TaxMetadata)
        })
    ])
)

export const TaxValidator = Compile(Tax)

export function isTax(action?: GameAction): action is Tax {
    return action?.type === ActionType.Tax
}

function ruledKinds(state: HydratedFeudumGameState, playerId: string) {
    return state.ruledSpaceIds(playerId).map((spaceId) => state.spaces[spaceId].location.kind)
}

/** R-3.12.1 2 shillings + 1 per other town or feudum ruled, the taxing town being one town. */
export function taxShillings(state: HydratedFeudumGameState, playerId: string): number {
    const others = ruledKinds(state, playerId).filter(
        (kind) => kind === 'town' || kind === 'feudum'
    )
    return TaxBaseShillings + others.length - 1
}

/** R-3.12.1 */
export function reasonTaxRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: CardPlayInput
): string | undefined {
    return (
        reasonCardPlayRefused(state, playerId, 'tax', input) ??
        (ruledKinds(state, playerId).includes('town') ? undefined : 'You rule no town.')
    )
}

/** R-3.12.2 The seat's marker from the general supply, else from its own Knight row. */
function takeReinforcement(
    state: HydratedFeudumGameState,
    playerId: string
): TaxMetadata['reinforcements'] {
    const player = state.getPlayerState(playerId)
    if ((state.supply.influence[player.color] ?? 0) > 0) {
        state.supply.influence[player.color] -= 1
        player.influenceSupply += 1
        return 'general-supply'
    }
    const row = state.guilds.knight.rows.find((candidate) => candidate.playerId === playerId)
    if (row && row.markers > 0) {
        row.markers -= 1
        player.influenceSupply += 1
        return 'knight-row'
    }
    return undefined
}

/** R-3.12, R-X.1 Reinforcements costs nothing and asks nothing, so it applies by itself. */
function resolveTax(state: HydratedFeudumGameState, playerId: string): TaxMetadata {
    const shillings = payShillingsFromSupply(state, playerId, taxShillings(state, playerId))
    const reinforcements = specialOffered(state, playerId, 'tax')
        ? takeReinforcement(state, playerId)
        : undefined
    return {
        shillings,
        ...(reinforcements ? { reinforcements } : {}),
        rankChanges: state.recomputeRanks(playerId)
    }
}

/** R-3.12 What the press would give, by the real rule on a copy (S22). */
export function taxPreview(state: HydratedFeudumGameState, playerId: string): TaxMetadata {
    return resolveTax(new HydratedFeudumGameState(state.dehydrate()), playerId)
}

export class HydratedTax extends HydratableAction<typeof Tax> implements Tax {
    declare type: ActionType.Tax
    declare playerId: string
    declare metadata?: TaxMetadata
    declare asRepeat?: RepeatMode
    declare secondCard?: true

    constructor(data: Tax) {
        super(data, TaxValidator)
    }

    /** R-3.12, R-X.1 */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonTaxRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        const special = specialOffered(state, this.playerId, 'tax')
        playCard(state, this.playerId, 'tax', special ? 'special' : 'regular', this)
        this.metadata = resolveTax(state, this.playerId)
    }
}

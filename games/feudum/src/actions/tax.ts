import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import { seatKnightRow } from '../model/knightRows.js'
import { payShillingsFromSupply } from '../model/supply.js'
import {
    CardPlayFields,
    playCard,
    reasonCardPlayRefused,
    reasonSpecialRefused,
    specialOffered,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'
import { ruledLocationKinds } from '../model/locationDiscs.js'

/** R-3.12.1 */
const TaxBaseShillings = 2

export type TaxMetadata = Type.Static<typeof TaxMetadata>
export const TaxMetadata = Type.Object({
    /** R-3.12.1, R-1.1-H1 */
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
            /** R-3.12.2, R-3.12-H1 Whether to collect Reinforcements; asked only when a marker can come. */
            collect: Type.Optional(Type.Boolean()),
            metadata: Type.Optional(TaxMetadata)
        })
    ])
)

export const TaxValidator = Compile(Tax)

export function isTax(action?: GameAction): action is Tax {
    return action?.type === ActionType.Tax
}

/** R-3.12.1 2 shillings + 1 per other town or feudum ruled, the taxing town being one town. */
export function taxShillings(state: HydratedFeudumGameState, playerId: string): number {
    const others = ruledLocationKinds(state, playerId).filter(
        (kind) => kind === 'town' || kind === 'feudum'
    )
    return TaxBaseShillings + others.length - 1
}

export type TaxInput = CardPlayInput & Pick<Tax, 'collect'>

/** R-3.12.2 Where the seat's marker would come from: the general supply, else its own Knight row. */
function reinforcementSource(
    state: HydratedFeudumGameState,
    playerId: string
): TaxMetadata['reinforcements'] {
    if ((state.supply.influence[playerId] ?? 0) > 0) {
        return 'general-supply'
    }
    const own = seatKnightRow(state, playerId)
    return own && own.row.markers > 0 ? 'knight-row' : undefined
}

/** R-3.12.2, R-3.12-H1 */
export function reinforcementsOffered(state: HydratedFeudumGameState, playerId: string): boolean {
    return (
        specialOffered(state, playerId, 'tax') && reinforcementSource(state, playerId) !== undefined
    )
}

function reasonCollectRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    collect: boolean | undefined
): string | undefined {
    if (reinforcementsOffered(state, playerId)) {
        return collect === undefined ? 'Collect Reinforcements or decline it.' : undefined
    }
    if (!collect) {
        return undefined
    }
    return (
        reasonSpecialRefused(state, playerId, 'tax') ??
        'No influence marker of yours is left to collect.'
    )
}

/** R-3.12.1, R-3.12-H1 */
export function reasonTaxRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: TaxInput
): string | undefined {
    return (
        reasonCardPlayRefused(state, playerId, 'tax', input) ??
        (ruledLocationKinds(state, playerId).includes('town') ? undefined : 'You rule no town.') ??
        reasonCollectRefused(state, playerId, input.collect)
    )
}

/** R-3.12.2 The seat's marker from the general supply, else from its own Knight row. */
function takeReinforcement(
    state: HydratedFeudumGameState,
    playerId: string
): TaxMetadata['reinforcements'] {
    const player = state.getPlayerState(playerId)
    const source = reinforcementSource(state, playerId)
    if (source === 'general-supply') {
        state.supply.influence[playerId] -= 1
    }
    const own = seatKnightRow(state, playerId)
    if (source === 'knight-row' && own) {
        own.row.markers -= 1
    }
    if (source) {
        player.influenceSupply += 1
    }
    return source
}

/** R-3.12, R-3.12-H1 The shillings, and the marker only when the seat collects it. */
function resolveTax(
    state: HydratedFeudumGameState,
    playerId: string,
    collect: boolean
): TaxMetadata {
    const shillings = payShillingsFromSupply(state, playerId, taxShillings(state, playerId))
    const reinforcements = collect ? takeReinforcement(state, playerId) : undefined
    return {
        shillings,
        ...(reinforcements ? { reinforcements } : {}),
        rankChanges: state.recomputeRanks(playerId)
    }
}

/** R-3.12 What the press would give, by the real rule on a copy (S22). */
export function taxPreview(
    state: HydratedFeudumGameState,
    playerId: string,
    { collect }: Pick<Tax, 'collect'>
): TaxMetadata {
    return resolveTax(new HydratedFeudumGameState(state.dehydrate()), playerId, collect === true)
}

export class HydratedTax extends HydratableAction<typeof Tax> implements Tax {
    declare type: ActionType.Tax
    declare playerId: string
    declare collect?: boolean
    declare metadata?: TaxMetadata
    declare asRepeat?: RepeatMode
    declare secondCard?: true

    constructor(data: Tax) {
        super(data, TaxValidator)
    }

    /** R-3.12, R-3.12-H1 */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonTaxRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        const collect = this.collect === true
        playCard(state, this.playerId, 'tax', collect ? 'special' : 'regular', this)
        this.metadata = resolveTax(state, this.playerId, collect)
    }
}

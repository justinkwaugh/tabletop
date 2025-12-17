import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    OffsetCoordinates,
    sameCoordinates
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { SundiverChain } from '../model/chain.js'

export type ChainMetadata = Static<typeof ChainMetadata>
export const ChainMetadata = Type.Object({})

export type Chain = Static<typeof Chain>
export const Chain = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Chain),
            playerId: Type.String(),
            chain: SundiverChain,
            metadata: Type.Optional(ChainMetadata)
        })
    ])
)

export const ChainValidator = Compile(Chain)

export function isChain(action?: GameAction): action is Chain {
    return action?.type === ActionType.Chain
}

export class HydratedChain extends HydratableAction<typeof Chain> implements Chain {
    declare type: ActionType.Chain
    declare playerId: string
    declare chain: SundiverChain
    declare metadata?: ChainMetadata
    constructor(data: Chain) {
        super(data, ChainValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (!this.isValidChain(state, this.playerId)) {
            throw Error('Invalid chain')
        }
    }

    isValidChain(state: HydratedSolGameState, playerId: string): boolean {
        return false
    }

    static canInitiateChainAt(state: HydratedSolGameState, coords: OffsetCoordinates): boolean {
        const cell = state.board.cellAt(coords)
        return (
            cell.sundivers.length > 0 &&
            state.board.neighborsAt(coords).some((neighbor) => neighbor.sundivers.length > 0)
        )
    }

    static canContinueChainAt(
        state: HydratedSolGameState,
        chain: SundiverChain,
        coords: OffsetCoordinates
    ): boolean {
        if (chain.length === 0) {
            return false
        }

        if (state.board.cellAt(coords).sundivers.length === 0) {
            return false
        }

        if (chain.find((entry) => sameCoordinates(entry.coords, coords))) {
            return false
        }

        let chainEnds = [chain[0]]
        if (chain.length > 1) {
            chainEnds.push(chain.at(-1)!)
        }

        return chainEnds.some((chainEntry) => state.board.areAdjacent(chainEntry.coords, coords))
    }
}

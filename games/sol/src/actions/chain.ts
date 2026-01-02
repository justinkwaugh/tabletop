import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import {
    coordinatesToNumber,
    GameAction,
    HydratableAction,
    MachineContext,
    OffsetCoordinates,
    sameCoordinates
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { SundiverChain } from '../model/chain.js'

export type PlayerChainResult = Static<typeof PlayerChainResult>
export const PlayerChainResult = Type.Object({
    playerId: Type.String(),
    momentumGained: Type.Number(),
    sundiverIdsReturned: Type.Array(Type.String())
})

export type ChainMetadata = Static<typeof ChainMetadata>
export const ChainMetadata = Type.Object({
    chainResults: Type.Record(Type.String(), PlayerChainResult)
})

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

        this.metadata = { chainResults: {} }

        for (let i = 0; i < this.chain.length; i++) {
            const entry = this.chain[i]
            const cell = state.board.cellAt(entry.coords)
            const sundiver = cell.sundivers.find((diver) => diver.id === entry.sundiverId)
            if (!sundiver) {
                throw Error('Cannot find chain sundiver')
            }

            const owner = state.getPlayerState(sundiver.playerId)
            owner.momentum += 1

            if (!this.metadata.chainResults[sundiver.playerId]) {
                this.metadata.chainResults[sundiver.playerId] = {
                    playerId: sundiver.playerId,
                    momentumGained: 0,
                    sundiverIdsReturned: []
                }
            }
            const result = this.metadata.chainResults[sundiver.playerId]
            result.momentumGained += 1

            if (i % 2 === 0) {
                const removed = state.board.removeSundiversAt([sundiver.id], entry.coords)
                if (removed.length === 0) {
                    throw Error('No sundiver removed for chain')
                }
                owner.addSundiversToHold(removed)
                result.sundiverIdsReturned.push(sundiver.id)
            }
        }

        state.activeEffect = undefined
    }

    isValidChain(state: HydratedSolGameState, _playerId: string): boolean {
        if (!HydratedChain.isChainComplete(state, this.chain)) {
            return false
        }

        const visited = new Set<number>()
        for (let i = 0; i < this.chain.length; i++) {
            const entry = this.chain[i]
            const { coords, sundiverId } = entry
            if (!sundiverId) {
                return false
            }

            const key = coordinatesToNumber(coords)
            if (visited.has(key)) {
                return false
            }
            visited.add(key)

            const cell = state.board.cellAt(coords)
            if (!cell.sundivers.find((diver) => diver.id === sundiverId)) {
                return false
            }

            if (i > 0 && !state.board.areAdjacent(coords, this.chain[i - 1].coords)) {
                return false
            }
        }

        return true
    }

    static canInitiateChainAt(state: HydratedSolGameState, coords: OffsetCoordinates): boolean {
        const cell = state.board.cellAt(coords)
        return (
            cell.sundivers.length > 0 &&
            state.board
                .neighborsAt(coords)
                .some(
                    (neighbor) =>
                        neighbor.sundivers.length > 0 &&
                        state.board.areAdjacent(coords, neighbor.coords)
                )
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

    static isChainComplete(state: HydratedSolGameState, chain: SundiverChain): boolean {
        if (chain.length < 2) {
            return false
        }

        if (chain.some((entry) => entry.sundiverId === undefined)) {
            return false
        }

        const ends = [chain[0], chain.at(-1)!]
        return !ends.some((end) =>
            state.board
                .neighborsAt(end.coords)
                .some((neighbor) => this.canContinueChainAt(state, chain, neighbor.coords))
        )
    }
}

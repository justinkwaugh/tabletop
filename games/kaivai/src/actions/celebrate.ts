import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { isCelebratableCell } from '../definition/cells.js'

export type Celebrate = Static<typeof Celebrate>
export const Celebrate = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Celebrate),
        playerId: Type.String(),
        islandId: Type.String()
    })
])

export const CelebrateValidator = TypeCompiler.Compile(Celebrate)

export function isCelebrate(action?: GameAction): action is Celebrate {
    return action?.type === ActionType.Celebrate
}

export class HydratedCelebrate extends HydratableAction<typeof Celebrate> implements Celebrate {
    declare type: ActionType.Celebrate
    declare playerId: string
    declare islandId: string

    constructor(data: Celebrate) {
        super(data, CelebrateValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        const { valid, reason } = HydratedCelebrate.isValidIsland(state, this.islandId)

        if (!valid) {
            throw Error(reason)
        }

        const island = state.board.islands[this.islandId]
        const celebratableCells = island.coordList
            .map((coords) => state.board.getCellAt(coords))
            .filter(isCelebratableCell)
        const totalFish = celebratableCells.reduce((acc, cell) => acc + cell.fish, 0)
        const bonusFish = Math.floor(totalFish / 3)

        for (const cell of celebratableCells) {
            const ownerState = state.getPlayerState(cell.owner)
            ownerState.score += cell.fish
            cell.fish = 0
        }

        const playerState = state.getPlayerState(this.playerId)
        playerState.score += bonusFish
    }

    static isValidIsland(
        state: HydratedKaivaiGameState,
        islandId: string
    ): { valid: boolean; reason: string } {
        const board = state.board
        const island = board.islands[islandId]
        if (!island) {
            return { valid: false, reason: 'Island not found' }
        }

        if (!island.coordList.map((coords) => board.getCellAt(coords)).some(isCelebratableCell)) {
            return { valid: false, reason: 'No celebratable cells on island' }
        }

        return { valid: true, reason: '' }
    }
}

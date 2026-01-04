import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { StationType } from '../components/stations.js'
import { Sundiver } from '../components/sundiver.js'
import { CARDS_DRAWN_PER_RING } from '../utils/solConstants.js'

export type SacrificeMetadata = Static<typeof SacrificeMetadata>
export const SacrificeMetadata = Type.Object({
    sacrificedSundivers: Type.Array(Sundiver),
    numSacrificedPerPlayer: Type.Record(Type.String(), Type.Number())
})

export type Sacrifice = Static<typeof Sacrifice>
export const Sacrifice = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Sacrifice),
            playerId: Type.String(),
            coords: OffsetCoordinates,
            metadata: Type.Optional(SacrificeMetadata)
        })
    ])
)

export const SacrificeValidator = Compile(Sacrifice)

export function isSacrifice(action?: GameAction): action is Sacrifice {
    return action?.type === ActionType.Sacrifice
}

export class HydratedSacrifice extends HydratableAction<typeof Sacrifice> implements Sacrifice {
    declare type: ActionType.Sacrifice
    declare playerId: string
    declare coords: OffsetCoordinates
    declare metadata?: SacrificeMetadata
    constructor(data: Sacrifice) {
        super(data, SacrificeValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (!HydratedSacrifice.canSacrificeAt(state, this.coords)) {
            throw Error('Invalid sacrifice')
        }
        const cell = state.board.cellAt(this.coords)
        const allSundivers = cell.sundivers
        const sundiverIds = allSundivers.map((s) => s.id)
        const removedSundivers = state.board.removeSundiversFromCell(sundiverIds, cell)
        for (const sundiver of removedSundivers) {
            const owner = state.getPlayerState(sundiver.playerId)
            owner.momentum += 2
        }
        this.metadata = {
            sacrificedSundivers: removedSundivers,
            numSacrificedPerPlayer: removedSundivers.reduce(
                (acc, sundiver) => {
                    acc[sundiver.playerId] = (acc[sundiver.playerId] || 0) + 1
                    return acc
                },
                {} as Record<string, number>
            )
        }

        state.cardsToDraw += CARDS_DRAWN_PER_RING[this.coords.row]
    }

    static canSacrifice(state: HydratedSolGameState): boolean {
        return Iterator.from(state.board).some((cell) => this.canSacrificeAt(state, cell.coords))
    }

    static canSacrificeAt(state: HydratedSolGameState, coords: OffsetCoordinates): boolean {
        const cell = state.board.cellAt(coords)
        if (!cell.station || cell.station.type !== StationType.SundiverFoundry) {
            return false
        }

        return cell.sundivers.length > 0
    }
}

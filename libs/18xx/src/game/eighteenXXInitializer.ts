import { Prng } from '@tabletop/common'
import { applyPrivateEffects } from '../privates/privateLifecycle.js'
import {
    BaseGameInitializer,
    Color,
    HydratedTurnManager,
    type Game,
    type PlayerState,
    type UninitializedGameState
} from '@tabletop/common'
import { createStockRound } from '../stock/stockRound.js'
import {
    EighteenXXState,
    FamilyStateDefinition,
    HydratedEighteenXXState,
    inKnownPhase
} from './eighteenXXState.js'
import type { EighteenXXTitleRules } from './eighteenXXTitleRules.js'
import type { InitialPosition, Opening } from './opening.js'
import { titleComponents } from './titleComponents.js'
export type InitialStateParts = {
    stockRoundNumber: number
    position: InitialPosition
    titleState?: Opening['titleState']
}
export type EighteenXXInitializerRules = Pick<
    EighteenXXTitleRules,
    | 'state'
    | 'phases'
    | 'createOpening'
    | 'trackRules'
    | 'stationRules'
    | 'routeRules'
    | 'trainRules'
    | 'privateRules'
    | 'stockRules'
>
export class EighteenXXInitializer extends BaseGameInitializer<
    EighteenXXState,
    HydratedEighteenXXState
> {
    static readonly playerColors = [
        Color.Blue,
        Color.Red,
        Color.Green,
        Color.Yellow,
        Color.Purple,
        Color.Orange
    ]
    constructor(protected readonly rules: EighteenXXInitializerRules) {
        super()
    }
    initializeGameState(game: Game, state: UninitializedGameState): HydratedEighteenXXState {
        const opening = this.rules.createOpening({
            players: this.playerStates(game),
            prng: new Prng(state.prng),
            config: game.config
        })
        const initialized = this.createInitialState(game, state, {
            stockRoundNumber: 1,
            position: opening.position,
            titleState: opening.titleState
        })
        opening.begin(initialized)
        this.applyPhaseEffects(initialized)
        return initialized
    }
    protected playerStates(game: Game): PlayerState[] {
        return game.players.map((player, index) => ({
            playerId: player.id,
            color: EighteenXXInitializer.playerColors[index]
        }))
    }
    protected createInitialState(
        game: Game,
        state: UninitializedGameState,
        parts: InitialStateParts
    ): HydratedEighteenXXState {
        const players = this.playerStates(game)
        const { map, tileSet, depot } = titleComponents(this.rules)
        return inKnownPhase(
            (this.rules.state ?? FamilyStateDefinition).hydrate(
                {
                    ...state,
                    players,
                    activePlayerIds: [players[0].playerId],
                    example: 'finances',
                    phaseEvents: [],
                    usedPrivatePowerIds: [],
                    machineState: 'StockRound',
                    stockRound: createStockRound(parts.stockRoundNumber),
                    turnManager: new HydratedTurnManager({
                        series: [{ type: 'turn', playerId: players[0].playerId, start: 0 }],
                        turnOrder: players.map((player) => player.playerId),
                        turnCounts: Object.fromEntries(
                            players.map((player) => [player.playerId, 0])
                        )
                    }),
                    ...parts.position,
                    ...parts.titleState
                },
                map,
                tileSet,
                depot
            ),
            this.rules.phases
        )
    }
    protected applyPhaseEffects(state: HydratedEighteenXXState): void {
        applyPrivateEffects(
            state,
            this.rules.privateRules.phaseEffects(state),
            this.rules.stockRules
        )
    }
}

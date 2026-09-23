import { Prng } from '@tabletop/common'
import { applyPrivateEffects } from '../privates/privateLifecycle.js'
import {
    BaseGameInitializer,
    Color,
    HydratedTurnManager,
    type Game,
    type PlayerState,
    type StartingPositionAssignment,
    type UninitializedGameState,
    validateStartingPositionAssignment
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
    startingPositions?: StartingPositionAssignment
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
    readonly supportsStartingPositions = true
    constructor(protected readonly rules: EighteenXXInitializerRules) {
        super()
    }
    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        startingPositions?: StartingPositionAssignment
    ): HydratedEighteenXXState {
        const players = this.playerStates(game)
        if (startingPositions !== undefined)
            validateStartingPositionAssignment(
                players.map((player) => player.playerId),
                startingPositions
            )
        const opening = this.rules.createOpening({
            players,
            prng: new Prng(state.prng),
            config: game.config,
            startingPositions
        })
        const initialized = this.createInitialState(game, state, {
            stockRoundNumber: 1,
            position: opening.position,
            titleState: opening.titleState,
            startingPositions
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
        const seatOrder = [
            ...(parts.startingPositions?.playerIds ?? players.map((player) => player.playerId))
        ]
        const { map, tileSet, depot } = titleComponents(this.rules)
        return inKnownPhase(
            (this.rules.state ?? FamilyStateDefinition).hydrate(
                {
                    ...state,
                    players,
                    activePlayerIds: [seatOrder[0]],
                    example: 'finances',
                    phaseEvents: [],
                    usedPrivatePowerIds: [],
                    machineState: 'StockRound',
                    stockRound: createStockRound(parts.stockRoundNumber),
                    turnManager: new HydratedTurnManager({
                        series: [{ type: 'turn', playerId: seatOrder[0], start: 0 }],
                        turnOrder: seatOrder,
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

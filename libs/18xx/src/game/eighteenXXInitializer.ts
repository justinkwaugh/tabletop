import {
    type Game,
    type PlayerState,
    type StartingPositionAssignment,
    type UninitializedGameState,
    BaseGameInitializer,
    Color,
    HydratedTurnManager,
    Prng,
    validateStartingPositionAssignment
} from '@tabletop/common'
import type * as Type from 'typebox'
import { applyPrivateEffects } from '../privates/privateLifecycle.js'
import { createStockRound } from '../stock/stockRound.js'
import type { EighteenXXRuntimeSchema } from './eighteenXXState.js'
import { type TitleStateSchema, HydratedEighteenXXState, inKnownPhase } from './eighteenXXState.js'
import type { EighteenXXTitleRules } from './eighteenXXTitleRules.js'
import type { InitialPosition, Opening } from './opening.js'
import { titleComponents } from './titleComponents.js'
export type InitialStateParts<Schema extends TitleStateSchema = EighteenXXRuntimeSchema> = {
    stockRoundNumber: number
    position: InitialPosition
    titleState?: Opening<Schema>['titleState']
    startingPositions?: StartingPositionAssignment
}
export type EighteenXXInitializerRules<
    Schema extends TitleStateSchema = EighteenXXRuntimeSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState =
        HydratedEighteenXXState<Schema> & HydratedEighteenXXState
> = Pick<
    EighteenXXTitleRules<Schema, State>,
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
export class EighteenXXInitializer<
    Schema extends TitleStateSchema = EighteenXXRuntimeSchema,
    State extends HydratedEighteenXXState<Schema> & HydratedEighteenXXState =
        HydratedEighteenXXState<Schema> & HydratedEighteenXXState
> extends BaseGameInitializer<Type.Static<Schema>, State> {
    static readonly playerColors = [
        Color.Blue,
        Color.Red,
        Color.Green,
        Color.Yellow,
        Color.Purple,
        Color.Orange
    ]
    readonly supportsStartingPositions = true
    constructor(protected readonly rules: EighteenXXInitializerRules<Schema, State>) {
        super()
    }
    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        startingPositions?: StartingPositionAssignment
    ): State {
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
        parts: InitialStateParts<Schema>
    ): State {
        const players = this.playerStates(game)
        const seatOrder = [
            ...(parts.startingPositions?.playerIds ?? players.map((player) => player.playerId))
        ]
        const { map, tileSet, depot } = titleComponents(this.rules)
        return inKnownPhase(
            this.rules.state.hydrate(
                {
                    ...state,
                    players,
                    activePlayerIds: [seatOrder[0]],
                    example: 'finances',
                    phaseEvents: [],
                    ...('usedPrivatePowerIds' in this.rules.state.schema.properties
                        ? { usedPrivatePowerIds: [] }
                        : {}),
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

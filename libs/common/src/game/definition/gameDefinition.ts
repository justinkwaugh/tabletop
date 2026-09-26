import type { TitlePreferenceDefinition } from '../../preferences/preferences.js'
import type * as Type from 'typebox'
import type { Validator } from 'typebox/compile'
import type { GameHydrator } from './gameHydrator.js'
import type { GameMetadata } from './gameMetadata.js'
import type { GameExploration } from './gameExploration.js'
import type { GameInitializer } from './gameInitializer.js'
import type { MachineStateHandler } from '../engine/machineStateHandler.js'
import type { HydratedAction } from '../engine/gameAction.js'
import type { GameStateLogger } from './gameStateLogger.js'
import type { GameConfigurator } from './gameConfigurator.js'
import type { RuntimeConfiguration } from './defineGame.js'
import type { Color } from '../model/colors.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'
import type { GameVisibility } from '../visibility/gameVisibility.js'
import type { GameScoring } from './gameScoring.js'

export interface GameInfo {
    id: string
    metadata: GameMetadata
    configurator?: GameConfigurator
    preferences?: TitlePreferenceDefinition
}

export interface GameRuntime<
    T extends GameState = GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
> {
    readonly configuration?: RuntimeConfiguration
    randomnessVersion?: 1
    initializer: GameInitializer<T, U>
    exploration?: GameExploration<T>
    hydrator: GameHydrator<T, U>
    canonicalStateValidator?: Pick<Validator, 'Check'>
    playerColors: Color[]
    apiActions: Record<string, Type.TSchema>
    stateHandlers: Record<string, MachineStateHandler<HydratedAction, U>>
    stateLogger?: GameStateLogger
    visibility?: GameVisibility<T, T>
    scoring?: GameScoring<T>
}

export interface GameDefinition<
    T extends GameState = GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
> {
    info: GameInfo
    runtime: GameRuntime<T, U>
}

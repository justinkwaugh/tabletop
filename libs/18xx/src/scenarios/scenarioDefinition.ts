import {
    ActionSource,
    GameEngine,
    GameStorage,
    PlayerStatus,
    type Game,
    type GameDefinition
} from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXTitleRules } from '../game/eighteenXXTitleRules.js'
import type { BuyShares } from '../stock/buyShares.js'
import type { President } from '../finance/finance.js'
import { ScenarioInitializer, type ScenarioFixtures } from './scenarioInitializer.js'
import { ScenarioConfigurator, type ScenarioPosition } from './scenarioPosition.js'

export type ScenarioDefinition = GameDefinition<EighteenXXState, HydratedEighteenXXState>

export function withScenarios(
    definition: ScenarioDefinition,
    rules: EighteenXXTitleRules,
    fixtures: ScenarioFixtures
): ScenarioDefinition {
    return {
        info: { ...definition.info, configurator: new ScenarioConfigurator() },
        runtime: { ...definition.runtime, initializer: new ScenarioInitializer(rules, fixtures) }
    }
}

// Examples are pinned by their numeric public seed, which a generated master seed would replace.
export function startFromPublicSeed(
    runtime: ScenarioDefinition['runtime'],
    game: Game
): EighteenXXState {
    return new GameEngine({ ...runtime, randomnessVersion: undefined }).startGame(game).initialState
}

const FourPlayerPositions: readonly ScenarioPosition[] = [
    'privates',
    'private-events',
    'transfers',
    'powers'
]
const PlayerIds = ['alex', 'blair', 'casey', 'drew', 'elliot', 'fran']

export function exampleGame(
    definition: ScenarioDefinition,
    examplePosition: ScenarioPosition = 'trading',
    playerCount = FourPlayerPositions.includes(examplePosition) ? 4 : 3,
    seed = 5
): {
    game: Game
    engine: GameEngine<EighteenXXState, HydratedEighteenXXState>
    state: EighteenXXState
} {
    const game = definition.runtime.initializer.initializeGame(
        {
            id: 'purchase-example',
            typeId: definition.info.id,
            name: 'Purchase example',
            ownerId: 'user',
            storage: GameStorage.Local,
            hotseat: true,
            seed,
            config: { examplePosition },
            players: PlayerIds.slice(0, playerCount).map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        definition
    )
    return {
        game,
        engine: new GameEngine(definition.runtime),
        state: startFromPublicSeed(definition.runtime, game)
    }
}

const alex = { kind: 'player', playerId: 'alex' } as const
export function purchase(certificateId: string, price: number, buyer: President = alex): BuyShares {
    return {
        id: 'buy',
        gameId: 'purchase-example',
        source: ActionSource.User,
        type: 'BuyShares',
        playerId: 'alex',
        buyer,
        certificateId,
        expectedPrice: price
    }
}

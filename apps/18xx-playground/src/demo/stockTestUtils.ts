import { ActionSource, GameEngine, GameStorage, PlayerStatus } from '@tabletop/common'
import { Definition as Top } from '@tabletop/the-old-prince'
import type { BuyShares, President, FinanceExamplePosition } from '@tabletop/18xx'
const alex = { kind: 'player', playerId: 'alex' } as const
export function example(
    definition: typeof Top,
    examplePosition: FinanceExamplePosition = 'trading',
    playerCount?: number,
    seed = 5
) {
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
            players: (playerCount
                ? ['alex', 'blair', 'casey', 'drew', 'elliot', 'fran'].slice(0, playerCount)
                : ['privates', 'private-events', 'transfers', 'powers'].includes(examplePosition)
                  ? ['alex', 'blair', 'casey', 'drew']
                  : ['alex', 'blair', 'casey']
            ).map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        definition
    )
    const engine = new GameEngine(definition.runtime)
    return { game, engine, state: engine.startGame(game).initialState }
}
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

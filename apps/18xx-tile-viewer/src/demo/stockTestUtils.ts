import { ActionSource, GameEngine, GameStorage, PlayerStatus } from '@tabletop/common'
import { Definition as Top } from '@tabletop/the-old-prince'
import type { BuyShares, President } from '@tabletop/18xx'
const alex = { kind: 'player', playerId: 'alex' } as const
export function example(definition: typeof Top) {
    const game = definition.runtime.initializer.initializeGame(
        {
            id: 'purchase-example',
            typeId: definition.info.id,
            name: 'Purchase example',
            ownerId: 'user',
            storage: GameStorage.Local,
            hotseat: true,
            seed: 5,
            players: ['alex', 'blair', 'casey'].map((id) => ({
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

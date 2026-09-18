import { enumerateRouteCandidates } from '../src/demo/routeCandidates.ts'
import { Definition, TheOldPrinceRouteRules as rules } from '@tabletop/the-old-prince'
import { GameEngine, GameStorage, PlayerStatus } from '@tabletop/common'
import { RouteEvaluation } from '@tabletop/18xx'
import board from './top-route-board.json' with { type: 'json' }
const game = Definition.runtime.initializer.initializeGame(
    {
        id: 'route-benchmark',
        typeId: Definition.info.id,
        name: 'Route benchmark',
        ownerId: 'user',
        storage: GameStorage.Local,
        hotseat: true,
        seed: 5,
        config: { examplePosition: 'routes' },
        players: ['alex', 'blair', 'casey'].map((id) => ({
            id,
            name: id,
            isHuman: true,
            status: PlayerStatus.Joined
        }))
    },
    Definition
)
const state = new GameEngine(Definition.runtime).startGame(game).initialState
Object.assign(state, structuredClone(board), { phaseId: 'D' })
const train = rules.depot.nextTrain(state.trainInventory, 'D')
rules.depot.purchase(state.trainInventory, train.id, 'D', { kind: 'company', companyId: 'ML' })
Definition.runtime.hydrator.hydrateState(state)
const start = performance.now(),
    running = new RouteEvaluation(state, rules)
let count = 0,
    firstMs,
    sample
for (const route of enumerateRouteCandidates(running, 'ML', train.id)) {
    if (count++ === 0) {
        firstMs = performance.now() - start
        sample = route
    }
}
const enumerationMs = performance.now() - start
const validationStart = performance.now()
for (let i = 0; i < 1000; i++) running.evaluate('ML', [sample])
console.log(
    JSON.stringify(
        {
            placedTiles: Object.keys(state.tileInventory.placements).length,
            candidates: count,
            firstMs,
            enumerationMs,
            meanValidationMs: (performance.now() - validationStart) / 1000
        },
        null,
        2
    )
)

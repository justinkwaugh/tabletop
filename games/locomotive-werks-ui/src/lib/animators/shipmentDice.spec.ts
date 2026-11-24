import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { AnimationContext, type GameStateChangeListener } from '@tabletop/frontend-components'
import { Definition, LwInfo, LwRuntime, type HydratedLwGameState } from '@tabletop/locomotive-werks'
import { ShipmentDiceAnimator, type DiceBoard, type ShipmentDiceHost } from './shipmentDice.js'

function startedGameState(): HydratedLwGameState {
    const game = LwRuntime.initializer.initializeGame(
        {
            id: 'shipment-dice',
            typeId: LwInfo.id,
            ownerId: 'p0',
            config: normalizeGameConfig(defaultGameConfig(LwInfo.configurator?.options ?? [])),
            players: Array.from({ length: 3 }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { initialState } = new GameEngine(LwRuntime).startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef'
    })
    return LwRuntime.hydrator.hydrateState(initialState)
}

// A state whose first locomotive has these Existing Orders.
function withOrders(faces: number[], actionCount: number): HydratedLwGameState {
    const state = startedGameState()
    state.spaces[0].existingOrders = faces
    state.actionCount = actionCount
    return state
}

function createAnimator(shown: HydratedLwGameState) {
    let listener: GameStateChangeListener<HydratedLwGameState> | undefined
    const host: ShipmentDiceHost = {
        gameState: shown,
        showBoardStep() {},
        addGameStateChangeListener(added) {
            listener = added
        },
        removeGameStateChangeListener() {
            listener = undefined
        }
    }
    const board: DiceBoard = { querySelector: () => ({ scaleY: 1, x: 0 }) }
    new ShipmentDiceAnimator(host, board).register()
    return () => listener
}

describe('order dice without their action', () => {
    it('steps forward over a die reduced in place within the 200ms fallback budget', async () => {
        const from = withOrders([5, 3], 1)
        const to = withOrders([2, 3], 2)
        const listener = createAnimator(to)
        const animationContext = new AnimationContext()
        await listener()?.({ kind: 'other-action', from, to, animationContext })

        expect(animationContext.actionTimeline.duration()).toBeGreaterThan(0)
        expect(animationContext.actionTimeline.duration()).toBeLessThanOrEqual(0.2)
    })
})

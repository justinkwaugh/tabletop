import { describe, expect, it } from 'vitest'
import {
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus
} from '@tabletop/common'
import { AnimationContext, type GameStateChangeListener } from '@tabletop/frontend-components'
import {
    Definition,
    MarracashInfo,
    MarracashRuntime,
    type HydratedMarracashGameState
} from '@tabletop/marracash'
import {
    DirectSeconds,
    VisitorMoveAnimator,
    type VisitorAnimationHost,
    type VisitorWalker
} from './visitorMoveAnimator.js'

function startingState(): HydratedMarracashGameState {
    const game = MarracashRuntime.initializer.initializeGame(
        {
            id: 'animation-test',
            typeId: MarracashInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig(defaultGameConfig(MarracashInfo.configurator?.options ?? [])),
            players: Array.from({ length: 3 }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { initialState } = new GameEngine(MarracashRuntime).startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef'
    })
    return MarracashRuntime.hydrator.hydrateState(initialState)
}

// A host whose walkers mount at once, as plain tween targets.
function createHost() {
    let listener: GameStateChangeListener<HydratedMarracashGameState> | undefined
    let walkers: VisitorWalker[] = []
    const host: VisitorAnimationHost & { listener(): typeof listener } = {
        get movingVisitors() {
            return walkers
        },
        set movingVisitors(next: VisitorWalker[]) {
            walkers = next
            for (const walker of next) animator.setElement(walker.id, { x: 0, y: 0 })
        },
        fountainVisitorOverrides: {},
        shopCustomerOverrides: {},
        addGameStateChangeListener(added) {
            listener = added
        },
        removeGameStateChangeListener() {
            listener = undefined
        },
        listener: () => listener
    }
    const animator = new VisitorMoveAnimator(host)
    animator.register()
    return host
}

describe('VisitorMoveAnimator', () => {
    it('keeps a direct, actionless change within its time budget', async () => {
        const from = startingState()
        const to = startingState()
        const [source, target] = to.fountains.filter((fountain) => fountain.visitors.length > 0)
        target.visitors.push(...source.visitors)
        source.visitors = []
        to.shops[0].ownerId = to.players[0].playerId
        to.shops[0].customers = 1
        from.shops[0].ownerId = to.players[0].playerId

        const host = createHost()
        const listener = host.listener()
        if (!listener) throw Error('The animator registers a listener')
        const animationContext = new AnimationContext()
        await listener({ from, to, animationContext })

        expect(host.movingVisitors.length).toBeGreaterThan(0)
        expect(animationContext.actionTimeline.duration()).toBeGreaterThan(0)
        expect(animationContext.actionTimeline.duration()).toBeLessThanOrEqual(DirectSeconds)
    })
})

import { describe, expect, it } from 'vitest'
import { defaultGameConfig, GameEngine, normalizeGameConfig, PlayerStatus } from '@tabletop/common'
import { Definition, MarracashInfo, MarracashRuntime } from '@tabletop/marracash'
import { waitingStatus } from './waitingStatus.js'

function openingState() {
    const game = MarracashRuntime.initializer.initializeGame(
        {
            id: 'waiting-status',
            typeId: MarracashInfo.id,
            ownerId: 'p0',
            config: normalizeGameConfig(
                defaultGameConfig(MarracashInfo.configurator?.options ?? [])
            ),
            players: Array.from({ length: 4 }, (_, index) => ({
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

describe('waitingStatus', () => {
    it('offers only an auction in the opening round, without reading hidden cash', () => {
        const state = openingState()
        const status = waitingStatus(state, () => undefined)
        expect(status).toEqual({
            kind: 'turn',
            playerId: state.activePlayerIds[0],
            secondAction: false,
            options: ['auction']
        })
    })

    it('leaves out the auction when visible cash is below the minimum bid', () => {
        const state = openingState()
        expect(waitingStatus(state, () => 50)).toMatchObject({ kind: 'turn', options: [] })
    })
})

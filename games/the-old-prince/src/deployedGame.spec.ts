import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus, type GameAction } from '@tabletop/common'
import type { EighteenXXState } from '@tabletop/18xx'
import { Definition } from './definition.js'

function readFixture(name: string) {
    return JSON.parse(
        readFileSync(new URL(`../test/fixtures/deployed-game/${name}.json`, import.meta.url), 'utf8')
    )
}

const latestState: EighteenXXState = readFixture('state')
const newestFirstActions: GameAction[] = readFixture('actions').map(
    ({ createdAt, updatedAt, ...action }: Record<string, string>) => ({
        ...action,
        createdAt: new Date(createdAt),
        ...(updatedAt ? { updatedAt: new Date(updatedAt) } : {})
    })
)

const engine = new GameEngine(Definition.runtime)
const game = Definition.runtime.initializer.initializeGame(
    {
        id: latestState.gameId,
        typeId: Definition.info.id,
        ownerId: latestState.players[0].playerId,
        players: latestState.players.map((player) => ({
            id: player.playerId,
            name: player.playerId,
            isHuman: true,
            status: PlayerStatus.Joined
        }))
    },
    Definition
)

// These resolutions ran before a player's last lot was offered automatically, so
// current logic also draws an identifier for the offer the player then made by hand.
const recordedBeforeAutomaticLotOffers = [56, 61, 66, 71]

function recordedStates(): EighteenXXState[] {
    const states = [latestState]
    for (const action of newestFirstActions)
        states.unshift(engine.undoProcessedAction({ action, state: states[0] }))
    return states
}

describe('the deployed game', () => {
    it('loads its latest canonical state without changing it', () => {
        engine.validateCanonicalState(latestState)
        expect(Definition.runtime.hydrator.hydrateState(latestState).dehydrate()).toEqual(
            latestState
        )
    })

    it('offers the active player the same actions', () => {
        expect(
            engine.getValidActionTypesForPlayer(game, latestState, latestState.activePlayerIds[0])
        ).toEqual(['LayTile', 'FinishTrack'])
    })

    it('reproduces every recorded state from its recorded action', () => {
        const states = recordedStates()
        const oldestFirstActions = [...newestFirstActions].reverse()
        expect(states).toHaveLength(oldestFirstActions.length + 1)
        for (const [index, action] of oldestFirstActions.entries()) {
            const { updatedState } = engine.executeSingleAction({
                action,
                state: states[index],
                game
            })
            const recorded = states[index + 1]
            expect(
                recordedBeforeAutomaticLotOffers.includes(index)
                    ? { ...updatedState, prng: recorded.prng }
                    : updatedState,
                `${index} ${action.type}`
            ).toEqual(recorded)
        }
    })
})

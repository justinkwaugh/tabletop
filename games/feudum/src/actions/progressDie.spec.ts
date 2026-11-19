import { ActionSource, Visibility, type RandomState } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { RegionIds, type RegionId } from '../data/regionTiles.js'
import type { Epoch } from '../data/tracks.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { FeudumGameState, HydratedFeudumGameState } from '../model/gameState.js'
import { stackTop } from '../model/regionStacks.js'
import { playOutCards, showOnStacks, typesOf, type StackShowing } from '../testing/roundEnd.js'
import { canonicalOf, initialState } from '../testing/state.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { HydratedRollProgressDie, isRollProgressDie } from './rollProgressDie.js'

const stateProjector = Visibility.createProjector(FeudumGameState)

function rollAction(): HydratedRollProgressDie {
    return new HydratedRollProgressDie({
        id: 'roll',
        gameId: 'game-1',
        source: ActionSource.System,
        type: ActionType.RollProgressDie
    })
}

/** A state at this epoch, these stack tops, on a protected stream started from `seed`. */
function stateRolling(epoch: Epoch, tops: readonly StackShowing[], seed: RandomState) {
    const state = initialState()
    showOnStacks(state, tops)
    state.epoch = epoch
    state.protectedPrng = { ...seed }
    return state
}

/** R-3.2 A round of one forfeit each, then `edit` before the last card's cascade. */
function tableAtLastCards(edit: (state: HydratedFeudumGameState) => void) {
    const table = tableAtPlayingCards(() => ({ cards: ['move'] }), 3)
    table.moveTo((state) => {
        edit(state)
        return MachineState.PlayingCards
    })
    return table
}

const chacha = (nibble: string): RandomState => ({
    algorithm: 'chacha20-v1',
    seed: nibble.repeat(64),
    invocations: 0
})

const AllLegal: readonly StackShowing[] = [1, 1, 1, 1, 1, 1]
/** Epoch I with only the mountain's top legal: every other stack shows epoch II. */
const MountainOnly: readonly StackShowing[] = [2, 2, 2, 2, 2, 1]

describe('R-4.11.1 golden vectors from seed to faces', () => {
    it.each<{ seed: string; tops: readonly StackShowing[]; faces: RegionId[] }>([
        { seed: '0', tops: AllLegal, faces: ['badlands'] },
        { seed: '1', tops: AllLegal, faces: ['forest'] },
        { seed: 'a', tops: AllLegal, faces: ['island'] },
        { seed: '0', tops: MountainOnly, faces: ['badlands', 'desert', 'mountain'] },
        { seed: '1', tops: MountainOnly, faces: ['forest', 'mountain'] },
        { seed: 'a', tops: MountainOnly, faces: ['island', 'desert', 'sea', 'forest', 'mountain'] }
    ])('seed $seed, tops $tops', ({ seed, tops, faces }) => {
        const state = stateRolling(1, tops, chacha(seed))
        const action = rollAction()

        action.apply(state)

        expect(action.metadata?.faces).toEqual(faces)
        expect(action.metadata?.removed?.region).toBe(faces.at(-1))
        expect(state.protectedPrng).toMatchObject({ invocations: faces.length })
    })

    it('R-4.11.1 each face is one of the six regions, about equally often', () => {
        const counts = new Map<RegionId, number>()
        for (let round = 0; round < 600; round += 1) {
            const state = stateRolling(1, AllLegal, { ...chacha('5'), invocations: round })
            const action = rollAction()
            action.apply(state)
            const [face] = action.metadata?.faces ?? []
            counts.set(face, (counts.get(face) ?? 0) + 1)
        }
        expect([...counts.keys()].toSorted()).toEqual([...RegionIds].toSorted())
        for (const count of counts.values()) {
            expect(count).toBeGreaterThan(60)
        }
    })
})

describe('R-4.11.1 the die removes a legal top tile', () => {
    it('R-4.11.1 rerolls until the only legal stack shows: only the last face counts', () => {
        const state = stateRolling(1, MountainOnly, chacha('1'))
        const lengths = RegionIds.map((region) => state.regionStacks[region].length)
        const action = rollAction()

        action.apply(state)

        const { faces = [], removed } = action.metadata ?? {}
        expect(faces.at(-1)).toBe('mountain')
        expect(faces.slice(0, -1)).not.toContain('mountain')
        expect(removed?.region).toBe('mountain')
        expect(RegionIds.map((region) => state.regionStacks[region].length)).toEqual(
            lengths.map((length, index) => (RegionIds[index] === 'mountain' ? length - 1 : length))
        )
    })

    it('R-4.11-H2 the tile leaves the game and its landscape is shown', () => {
        const state = stateRolling(1, MountainOnly, chacha('1'))
        const tileId = state.regionStacks.mountain[0]
        const landscape = state.requireVault().tileLandscapes[tileId]
        const action = rollAction()

        action.apply(state)

        expect(action.metadata?.removed).toEqual({ region: 'mountain', tileId, landscape })
        expect(state.tilesOutOfGame).toContain(tileId)
        expect(state.tileLandscapes[tileId]).toBe(landscape)
        expect(state.requireVault().tileLandscapes).not.toHaveProperty(tileId)
    })

    it('R-4.3.1 a tile of a former epoch is legal: the stack below it stays', () => {
        const state = stateRolling(3, [4, 4, 4, 4, 4, 2], chacha('1'))
        const action = rollAction()

        action.apply(state)

        expect(action.metadata?.removed?.region).toBe('mountain')
        expect(stackTop(state, 'mountain')?.epoch).toBe(3)
    })
})

describe('R-4.11.1, R-6.1-H1 when the die is not rolled', () => {
    it('R-4.11.1 no legal tile anywhere: no roll, nothing revealed', () => {
        const state = stateRolling(1, [2, 2, 2, 2, 2, 2], chacha('1'))
        const stacks = structuredClone(state.regionStacks)
        const action = rollAction()

        action.apply(state)

        expect(action.metadata?.faces).toEqual([])
        expect(action.metadata).not.toHaveProperty('removed')
        expect(action.revealsInfo).toBeFalsy()
        expect(state.regionStacks).toEqual(stacks)
        expect(state.protectedPrng).toMatchObject({ invocations: 0 })
    })

    it('R-6.1-H1 the V condition met before this step: no roll, though legal tiles remain', () => {
        const state = stateRolling(4, [4, 4, 4, 4, 4, 'V'], chacha('1'))
        const action = rollAction()

        action.apply(state)

        expect(action.metadata?.faces).toEqual([])
        expect(action.revealsInfo).toBeFalsy()
        expect(state.protectedPrng).toMatchObject({ invocations: 0 })
        expect(state.flow.epochTriggered).toBe(5)
    })

    it('R-6.1-H1 an earlier epoch’s condition does not stop the die', () => {
        const state = stateRolling(1, [2, 2, 2, 2, 1, 1], chacha('1'))
        const action = rollAction()

        action.apply(state)

        expect(action.metadata?.faces.length).toBeGreaterThan(0)
    })
})

describe('R-X.2 the roll in the round', () => {
    it('R-4.11.1 runs after the last nourish, as a System Action a seat cannot send', () => {
        const table = tableAtLastCards(() => {})
        const [first] = table.order
        expect(() => table.send(first, { type: ActionType.RollProgressDie })).toThrow()

        const processed = playOutCards(table)

        expect(typesOf(processed)).toContain(ActionType.RollProgressDie)
        const roll = processed.find((action) => isRollProgressDie(action))
        expect(roll?.source).toBe(ActionSource.System)
        expect(table.offered(first)).not.toContain(ActionType.RollProgressDie)
    })

    it('R-X.2 a roll is a barrier, and a removed tile is public in metadata', () => {
        const table = tableAtLastCards(() => {})
        const roll = playOutCards(table).find((action) => isRollProgressDie(action))

        expect(roll?.revealsInfo).toBe(true)
        expect(roll).toMatchObject({ metadata: { removed: { region: expect.any(String) } } })
    })

    it('R-2.2 marks the progress phase', () => {
        const table = tableAtLastCards(() => {})
        playOutCards(table)
        expect(table.state.phaseManager.series.map((phase) => phase.name)).toContain(
            PhaseName.Progress
        )
    })

    it('R-1.4-H2, R-5.2 a projected client cannot lift the tile, so it defers to the host', () => {
        const table = tableAtLastCards(() => {})
        const [first] = table.order
        const projected = new HydratedFeudumGameState(
            stateProjector.project(
                canonicalOf(table.hydrated()),
                { kind: 'player', playerId: first },
                { config: {} }
            )
        )

        expect(() => rollAction().apply(projected)).toThrow()
    })
})

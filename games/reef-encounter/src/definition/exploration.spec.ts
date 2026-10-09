import { assert, assertExists, getPrng, Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { CoralColor, CoralColors, coralCounts, totalCount } from '../components/colors.js'
import {
    ReefEncounterGameStateValidator,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import { completeSetup, dealtColorOf, startTestGame, type TestSession } from '../util/testHelper.js'
import type { ReefEncounterGameConfig } from './config.js'
import { PolypsPerColor } from './initializer.js'
import { ReefEncounterRuntime } from './runtime.js'
import { MachineState } from './states.js'

const spectator = { kind: 'spectator' } as const

function asPlayer(playerId: string) {
    return { kind: 'player', playerId } as const
}

function perspectivesFor(state: ReefEncounterProjectedState): Visibility.Perspective[] {
    return [spectator, ...state.turnManager.turnOrder.map(asPlayer)]
}

function project(
    session: TestSession,
    perspective: Visibility.Perspective,
    state: ReefEncounterProjectedState = session.state
): ReefEncounterProjectedState {
    assert(ReefEncounterGameStateValidator.Check(state), 'Projection starts from canonical state')
    return ReefEncounterRuntime.visibility.state.project(state, perspective, {
        config: session.game.config
    })
}

function populate(
    session: TestSession,
    perspective: Visibility.Perspective,
    state: ReefEncounterProjectedState = session.state,
    seed = 123
) {
    const exploration = ReefEncounterRuntime.exploration
    assertExists(exploration.createFromProjectedState, 'Expected population')
    return exploration.createFromProjectedState({
        game: session.game,
        state: project(session, perspective, state),
        actions: session.actions,
        perspective,
        random: getPrng(seed)
    })
}

// A few ordinary turns, each taking the first open-sea space whose cube can be replaced.
function playTurns(config: Partial<ReefEncounterGameConfig> = {}, turns = 4) {
    const session = startTestGame(3, config)
    completeSetup(session)
    for (let turn = 0; turn < turns; turn++) {
        const space = session.state.openSea.find(
            (candidate) => session.state.larvaCubeSupply[candidate.larvaColor] > 0
        )
        assertExists(space, 'An open-sea space can be taken')
        session.takeOpenSeaSpace(session.currentPlayerId(), space.larvaColor)
    }
    return session
}

function everyPolyp(state: ReefEncounterProjectedState) {
    const counts = coralCounts()
    const add = (colors: readonly CoralColor[]) => {
        for (const color of colors) counts[color] += 1
    }
    add(state.reefs.flatMap((reef) => reef.polyps.map((polyp) => polyp.color)))
    add(state.openSea.flatMap((space) => space.polyps))
    add(state.polypBag.items)
    for (const color of CoralColors) {
        counts[color] += state.bonusPolyps[color]
        for (const player of state.players) {
            counts[color] +=
                (player.knownScreenPolyps?.[color] ?? 0) +
                (player.secretScreenPolyps?.[color] ?? 0) +
                (player.knownParrotfishPolyps?.[color] ?? 0) +
                (player.secretParrotfishPolyps?.[color] ?? 0) +
                player.consumedPolyps[color]
        }
    }
    return counts
}

describe('exploring from what a player can see', () => {
    it('deals the unseen polyps into a complete game that looks the same to the viewer', () => {
        const session = playTurns()
        for (const perspective of perspectivesFor(session.state)) {
            const sample = populate(session, perspective)

            expect(ReefEncounterGameStateValidator.Check(sample)).toBe(true)
            expect(populate(session, perspective)).toEqual(sample)
            expect(project(session, perspective, sample)).toEqual(project(session, perspective))
            expect(everyPolyp(sample)).toEqual(coralCounts(PolypsPerColor))
            expect(sample.polypBag.items).toHaveLength(sample.polypBag.remaining)
            for (const player of sample.players) {
                expect(totalCount(player.secretScreenPolyps ?? coralCounts())).toBe(
                    player.secretScreenPolypCount
                )
                expect(totalCount(player.secretParrotfishPolyps ?? coralCounts())).toBe(1)
            }
        }
        expect(populate(session, spectator, session.state, 7)).not.toEqual(
            populate(session, spectator)
        )
    })

    it('keeps what the viewer may see, and nothing else, from the real game', () => {
        const session = playTurns()
        const [viewer, other] = session.state.turnManager.turnOrder
        const real = session.state

        const sample = populate(session, asPlayer(viewer))
        const own = (state: ReefEncounterProjectedState) =>
            state.players.find((player) => player.playerId === viewer)
        expect(own(sample)?.secretScreenPolyps).toEqual(own(real)?.secretScreenPolyps)
        expect(own(sample)?.secretParrotfishPolyps).toEqual(own(real)?.secretParrotfishPolyps)

        // Swap one of another player's secret polyps with a bag polyp of another colour: the
        // viewer can't tell the difference, so neither may the sample.
        const swapped = structuredClone(real)
        const hidden = swapped.players.find((player) => player.playerId === other)
        assertExists(hidden?.secretScreenPolyps, 'The other player has secret polyps')
        const held = CoralColors.find((color) => (hidden.secretScreenPolyps?.[color] ?? 0) > 0)
        assertExists(held, 'The other player holds a secret polyp')
        const bagIndex = swapped.polypBag.items.findIndex((color) => color !== held)
        const bagColor = swapped.polypBag.items[bagIndex]
        swapped.polypBag.items[bagIndex] = held
        hidden.secretScreenPolyps[held] -= 1
        hidden.secretScreenPolyps[bagColor] += 1
        swapped.polypBag.items.reverse()

        expect(project(session, asPlayer(viewer), swapped)).toEqual(
            project(session, asPlayer(viewer))
        )
        expect(populate(session, asPlayer(viewer), swapped)).toEqual(sample)
    })

    it('fills only the parrotfish already fed during setup', () => {
        const session = startTestGame(3)
        const [first, second, third] = session.state.turnManager.turnOrder
        session.feedParrotfish(first, dealtColorOf(session, first))
        expect(session.state.machineState).toBe(MachineState.ChoosingParrotfishPolyp)

        const sample = populate(session, asPlayer(third))
        const fed = (playerId: string) =>
            totalCount(
                sample.players.find((player) => player.playerId === playerId)
                    ?.secretParrotfishPolyps ?? coralCounts()
            )
        expect([fed(first), fed(second), fed(third)]).toEqual([1, 0, 0])
        expect(everyPolyp(sample)).toEqual(coralCounts(PolypsPerColor))
    })

    it('is unavailable while the game is Concealed', () => {
        const session = playTurns({ concealed: true })
        const [viewer] = session.state.turnManager.turnOrder
        expect(() => populate(session, asPlayer(viewer))).toThrow(/Concealed/)
    })

    it('keeps every secret shown at the end of the game, Concealed or not', () => {
        for (const concealed of [false, true]) {
            const session = playTurns({ concealed })
            session.edit((draft) => {
                draft.larvaCubeSupply[CoralColor.Orange] = 0
            })
            session.takeOpenSeaSpace(session.currentPlayerId(), CoralColor.Orange)
            expect(session.state.machineState).toBe(MachineState.EndOfGame)

            for (const perspective of perspectivesFor(session.state)) {
                const sample = populate(session, perspective)
                expect(sample.players).toEqual(session.state.players)
                expect(everyPolyp(sample)).toEqual(coralCounts(PolypsPerColor))
            }
        }
    })
})

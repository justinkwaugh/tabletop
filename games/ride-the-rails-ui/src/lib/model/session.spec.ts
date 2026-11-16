import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import {
    GameSession,
    setStagedSelectionValue,
    undoableStagedSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import {
    type HydratedRideTheRailsGameState,
    MachineState,
    PhaseName,
    isEndBuilding,
    isPlaceLocomotive,
    isTakeShare,
    legalPlacements,
    adjacentHexIds,
    usaCity,
    type HexId,
    type RailroadId,
    type Shares
} from '@tabletop/ride-the-rails'
import { buildState, type StateRecipe } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import { TABLE_FIXTURES, tableState } from '$lib/testing/tableFixtures.js'
import type { OfferedHex } from './boardOffer.js'
import {
    BuildStageOrder,
    pickBuildHex,
    unpickBuildHex,
    type BuildStageValues
} from './buildStage.js'
import type { RideTheRailsGameSession } from './session.svelte.js'
import { startCues } from '$lib/utils/startCues.js'

const NEW_YORK: HexId = 'hex.usa.6-60'
const PHILADELPHIA: HexId = 'hex.usa.7-57'
const DENVER: HexId = 'hex.usa.8-22'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

function holding(...railroadIds: RailroadId[]): Shares {
    return Object.fromEntries(railroadIds.map((railroadId) => [railroadId, 1]))
}

function building(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
    return buildState({ phase: PhaseName.Build, ...recipe })
}

// Red in New York and Blue in Philadelphia, held by p1: the hexes between them take either.
function redAndBlue(): HydratedRideTheRailsGameState {
    return building({
        shares: { p1: holding('railroad.red', 'railroad.blue') },
        track: { [NEW_YORK]: ['railroad.red'], [PHILADELPHIA]: ['railroad.blue'] }
    })
}

// Red and Blue both in New York, held by p1: every hex beside it takes either.
function bothInNewYork(): HydratedRideTheRailsGameState {
    return building({
        shares: { p1: holding('railroad.red', 'railroad.blue') },
        track: { [NEW_YORK]: ['railroad.red', 'railroad.blue'] }
    })
}

function litWith(session: RideTheRailsGameSession, railroads: number): OfferedHex {
    const hex = session.boardOffer.lit.find((lit) => lit.placements.length === railroads)
    assertExists(hex, `No lit hex with ${railroads} railroads`)
    return hex
}

function otherLitWith(session: RideTheRailsGameSession, railroads: number, hexId: HexId) {
    const hex = session.boardOffer.lit.find(
        (lit) => lit.placements.length === railroads && lit.hexId !== hexId
    )
    assertExists(hex, `No second lit hex with ${railroads} railroads`)
    return hex
}

function spyOnApply() {
    return vi.spyOn(GameSession.prototype, 'applyAction').mockResolvedValue()
}

function spyOnActionUndo() {
    return vi.spyOn(GameSession.prototype, 'undoCommittedAction').mockResolvedValue()
}

function sentAction(apply: ReturnType<typeof spyOnApply>) {
    expect(apply).toHaveBeenCalledOnce()
    return apply.mock.calls[0][0]
}

async function settled(session: RideTheRailsGameSession) {
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

describe('the board offer in Building (R-3.2, R-4.1, R-4.2)', () => {
    it('lights exactly the legal placements of the deciding seat, with a scrim hole for each', async () => {
        const state = redAndBlue()
        const session = await openSessionOn(state)
        const lit = session.boardOffer.lit.flatMap((hex) =>
            hex.placements.map(({ railroadId, isStart }) => ({
                railroadId,
                hexId: hex.hexId,
                isStart
            }))
        )
        const key = (placement: { railroadId: string; hexId: string }) =>
            `${placement.railroadId} ${placement.hexId}`
        expect(lit.map(key).sort()).toEqual(legalPlacements(state, 'p1').map(key).sort())
        expect(session.boardOffer.scrim?.holes).toEqual(
            session.boardOffer.lit.map((hex) => hex.hexId)
        )
    })

    it('offers nothing to a waiting seat', async () => {
        const session = await openSessionOn(redAndBlue())
        expect(session.canViewAsNonActivePlayer).toBe(true)
        session.setViewingAsNonActivePlayer(true)
        flushSync()
        expect(session.myPlayerId).not.toBe('p1')
        expect(session.building).toBe(false)
        expect(session.boardOffer.lit).toEqual([])
        expect(session.boardOffer.scrim).toBeUndefined()
    })

    it('offers nothing while the visible state is updating, and the open pick comes back if nothing replaced it', async () => {
        const session = await openSessionOn(redAndBlue())
        const shared = litWith(session, 2)
        await session.pressHex(shared.hexId)
        session.updatingVisibleState = true
        expect(session.boardOffer.lit).toEqual([])
        expect(session.boardOffer.popup).toBeUndefined()
        expect(session.buildHexId).toBeUndefined()
        session.updatingVisibleState = false
        expect(session.buildHexId).toBe(shared.hexId)
    })

    it('offers nothing in History View, where a press only shows the hex', async () => {
        const session = await openSessionOn(redAndBlue())
        const single = litWith(session, 1)
        await session.pressHex(single.hexId)
        await settled(session)
        expect(session.gameState.actionCount).toBe(1)

        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(session.gameState.machineState).toBe(MachineState.Building)
        expect(session.boardOffer.lit).toEqual([])

        const apply = spyOnApply()
        await session.pressHex(single.hexId)
        expect(apply).not.toHaveBeenCalled()
        expect(session.buildHexId).toBeUndefined()
    })

    it.each(['city.usa.chicago', 'city.usa.omaha'] as const)(
        'lights and cues no Yellow start once Yellow has started in %s (R-4.2.3)',
        async (cityId) => {
            const yellow: RailroadId = 'railroad.yellow'
            const fixture = TABLE_FIXTURES.find((candidate) => candidate.slug === 'yellow-starts')
            assertExists(fixture)
            const session = await openSessionOn(tableState(fixture.recipe))
            const yellowStarts = () =>
                session.boardOffer.lit
                    .filter((hex) =>
                        hex.placements.some(
                            (placement) => placement.railroadId === yellow && placement.isStart
                        )
                    )
                    .map((hex) => hex.hexId)
            const yellowCues = () =>
                startCues(session.gameState).filter((cue) => cue.railroadId === yellow)
            expect(yellowStarts()).toHaveLength(4)
            expect(yellowCues()).toHaveLength(4)

            const start = usaCity(cityId).hexId
            await session.placeLocomotive(yellow, start)
            await settled(session)
            expect(session.gameState.track[start]).toContain(yellow)
            expect(yellowStarts()).toEqual([])
            expect(yellowCues()).toEqual([])
            const yellowLit = session.boardOffer.lit.filter((hex) =>
                hex.placements.some((placement) => placement.railroadId === yellow)
            )
            expect(yellowLit.length).toBeGreaterThan(0)
            for (const hex of yellowLit) {
                expect(adjacentHexIds(hex.hexId)).toContain(start)
            }
        }
    )
})

describe('placing a locomotive (U-2, R-3.2)', () => {
    it('sends a placement at once on a lit hex only one railroad may enter', async () => {
        const session = await openSessionOn(redAndBlue())
        const single = litWith(session, 1)
        const apply = spyOnApply()
        await session.pressHex(single.hexId)
        const action = sentAction(apply)
        expect(isPlaceLocomotive(action) && [action.railroadId, action.hexId]).toEqual([
            single.placements[0].railroadId,
            single.hexId
        ])
        expect(session.buildHexId).toBeUndefined()
    })

    it('asks which railroad on a lit hex two railroads may enter, and the chip sends it', async () => {
        const session = await openSessionOn(redAndBlue())
        const shared = litWith(session, 2)
        const apply = spyOnApply()
        await session.pressHex(shared.hexId)
        expect(apply).not.toHaveBeenCalled()
        expect(session.buildHexId).toBe(shared.hexId)
        expect(session.boardOffer.popup?.chips.map((chip) => chip.railroadId)).toEqual([
            'railroad.red',
            'railroad.blue'
        ])

        await session.chooseRailroad('railroad.blue')
        const action = sentAction(apply)
        expect(isPlaceLocomotive(action) && [action.railroadId, action.hexId]).toEqual([
            'railroad.blue',
            shared.hexId
        ])
    })

    it('sends nothing for a railroad or hex the offer does not light', async () => {
        const session = await openSessionOn(redAndBlue())
        const apply = spyOnApply()
        await session.placeLocomotive('railroad.orange', litWith(session, 2).hexId)
        await session.placeLocomotive('railroad.red', DENVER)
        await session.chooseRailroad('railroad.red')
        expect(apply).not.toHaveBeenCalled()
    })

    it('places the chosen railroad and clears the pick when the new Game State arrives', async () => {
        const session = await openSessionOn(redAndBlue())
        const shared = litWith(session, 2)
        await session.pressHex(shared.hexId)
        await session.chooseRailroad('railroad.blue')
        await settled(session)
        expect(session.gameState.track[shared.hexId]).toEqual(['railroad.blue'])
        expect(session.gameState.building?.placed).toBe(1)
        expect(session.buildHexId).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
    })

    it('closes the pick when any new Game State is shown', async () => {
        const session = await openSessionOn(redAndBlue())
        await session.pressHex(litWith(session, 2).hexId)
        const elsewhere = building({
            shares: { p1: holding('railroad.red', 'railroad.blue') },
            track: {
                [NEW_YORK]: ['railroad.red'],
                [PHILADELPHIA]: ['railroad.blue'],
                [DENVER]: ['railroad.black']
            }
        })
        await session.presentState(elsewhere.dehydrate())
        flushSync()
        expect(session.buildHexId).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
    })

    it('Undo closes the popup and places nothing; a second Undo takes back the previous placement (R-5)', async () => {
        const session = await openSessionOn(redAndBlue())
        const single = litWith(session, 1)
        await session.pressHex(single.hexId)
        await settled(session)
        expect(session.gameState.actionCount).toBe(1)

        const shared = litWith(session, 2)
        await session.pressHex(shared.hexId)
        expect(session.buildHexId).toBe(shared.hexId)

        await session.undo()
        expect(session.buildHexId).toBeUndefined()
        expect(session.gameState.actionCount).toBe(1)

        await session.undo()
        await settled(session)
        expect(session.gameState.actionCount).toBe(0)
        expect(session.gameState.track[single.hexId]).toBeUndefined()
    })

    it('names the deciding seat’s building turn, the same across its placements', async () => {
        const session = await openSessionOn(redAndBlue())
        const turn = session.buildingTurn
        expect(turn).toBeDefined()
        await session.pressHex(litWith(session, 1).hexId)
        await settled(session)
        expect(session.gameState.building?.placed).toBe(1)
        expect(session.buildingTurn).toBe(turn)

        await session.endBuilding()
        await settled(session)
        expect(session.buildingTurn).not.toBe(turn)
    })

    it('names no building turn for a waiting seat', async () => {
        const session = await openSessionOn(redAndBlue())
        session.setViewingAsNonActivePlayer(true)
        flushSync()
        expect(session.buildingTurn).toBeUndefined()
    })

    it('ends the building turn on Done building, with no placement made (R-3.2.1)', async () => {
        const session = await openSessionOn(redAndBlue())
        const apply = spyOnApply()
        await session.endBuilding()
        expect(isEndBuilding(sentAction(apply))).toBe(true)
    })
})

describe('the build stage (docs/user-interactions.md)', () => {
    it('re-picking replaces the picked hex, keeping no earlier one for Undo', () => {
        const once = pickBuildHex({}, NEW_YORK)
        const twice = pickBuildHex(once, PHILADELPHIA)
        expect(twice).toEqual({ hex: { value: PHILADELPHIA, source: 'manual' } })
        expect(unpickBuildHex(twice)).toEqual({})
    })

    it('Undo with a pick open pops it and undoes no action', async () => {
        const actionUndo = spyOnActionUndo()
        const session = await openSessionOn(redAndBlue())
        await session.pressHex(litWith(session, 2).hexId)
        expect(session.hasLocalSelection).toBe(true)
        await session.undo()
        expect(session.buildHexId).toBeUndefined()
        expect(actionUndo).not.toHaveBeenCalled()
        await session.undo()
        expect(actionUndo).toHaveBeenCalledOnce()
    })

    it('Undo passes over an auto pick to the action', () => {
        let stage: StagedSelectionState<BuildStageValues> = setStagedSelectionValue<
            BuildStageValues,
            'hex'
        >({}, BuildStageOrder, 'hex', NEW_YORK, 'auto')
        const selection = undoableStagedSelection(
            BuildStageOrder,
            () => stage,
            (next) => (stage = next)
        )
        expect(selection.hasManual()).toBe(false)
        expect(selection.undo()).toBe(false)
        expect(stage.hex?.value).toBe(NEW_YORK)
    })

    it('rejects a stage outside the order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, unknown>, string>(
                {},
                BuildStageOrder,
                'railroad',
                'railroad.red',
                'manual'
            )
        ).toThrow()
    })

    it('a press on another two-railroad hex moves the pick, and a second press on it closes it', async () => {
        const session = await openSessionOn(bothInNewYork())
        const first = litWith(session, 2)
        const second = otherLitWith(session, 2, first.hexId)
        await session.pressHex(first.hexId)
        await session.pressHex(second.hexId)
        expect(session.buildHexId).toBe(second.hexId)
        expect(session.boardOffer.popup?.hexId).toBe(second.hexId)
        await session.pressHex(second.hexId)
        expect(session.buildHexId).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
    })
})

describe('railroad spotlight', () => {
    it('follows the pointer until a press holds it; a second press releases it and another moves it', async () => {
        const session = await openSessionOn(redAndBlue())
        session.hoverRailroad('railroad.blue')
        expect(session.spotlightRailroadId).toBe('railroad.blue')
        session.leaveRailroad()
        expect(session.spotlightRailroadId).toBeUndefined()

        session.pressRailroad('railroad.red')
        session.hoverRailroad('railroad.blue')
        session.leaveRailroad()
        expect(session.spotlightRailroadId).toBe('railroad.red')
        session.pressRailroad('railroad.blue')
        expect(session.spotlightRailroadId).toBe('railroad.blue')
        session.pressRailroad('railroad.blue')
        expect(session.spotlightRailroadId).toBeUndefined()
    })

    it('holds a railroad for the building zoom only once pressed, never on a hover', async () => {
        const session = await openSessionOn(redAndBlue())
        session.hoverRailroad('railroad.blue')
        expect(session.heldRailroadId).toBeUndefined()
        session.pressRailroad('railroad.blue')
        expect(session.heldRailroadId).toBe('railroad.blue')
        session.pressRailroad('railroad.blue')
        expect(session.heldRailroadId).toBeUndefined()
    })

    it('survives a new Game State and leaves the offer as it is', async () => {
        const state = redAndBlue()
        const session = await openSessionOn(state)
        const lit = session.boardOffer.lit
        session.pressRailroad('railroad.red')
        await session.presentState(state.dehydrate())
        flushSync()
        expect(session.spotlightRailroadId).toBe('railroad.red')
        expect(session.boardOffer.lit).toEqual(lit)
    })
})

describe('the other actions', () => {
    it('takes a share of an available railroad and nothing else (R-3.1, R-1.4)', async () => {
        const session = await openSessionOn(buildState({ phase: PhaseName.TakeShare }))
        expect(session.shareChoices).toEqual(['railroad.red', 'railroad.blue'])
        expect(session.boardOffer.lit).toEqual([])
        const apply = spyOnApply()
        await session.takeShare('railroad.orange')
        expect(apply).not.toHaveBeenCalled()
        await session.takeShare('railroad.blue')
        const action = sentAction(apply)
        expect(isTakeShare(action) && action.railroadId).toBe('railroad.blue')
    })

    it('sends no share outside its phase', async () => {
        const session = await openSessionOn(redAndBlue())
        const apply = spyOnApply()
        await session.takeShare('railroad.red')
        expect(apply).not.toHaveBeenCalled()
        expect(session.gameState.machineState).toBe(MachineState.Building)
    })
})

describe('the Transcontinental line toggle (R-4.3.3)', () => {
    // Purple waits beside Denver, where Orange's line from Chicago ends: placing it there claims.
    async function inReach() {
        const fixture = TABLE_FIXTURES.find(
            (candidate) => candidate.slug === 'transcontinental-in-reach'
        )
        assertExists(fixture)
        return openSessionOn(tableState(fixture.recipe))
    }

    async function claim(session: RideTheRailsGameSession) {
        await session.placeLocomotive('railroad.purple', DENVER)
        await settled(session)
        expect(session.gameState.transcontinental).toBeDefined()
    }

    it('is not offered while the line is unclaimed, and a press there changes nothing', async () => {
        const session = await inReach()
        expect(session.transcontinentalLineToggle).toBeUndefined()
        session.toggleTranscontinentalLine()
        expect(session.transcontinentalLineToggle).toBeUndefined()
        expect(session.showsTranscontinentalLine).toBe(false)

        await claim(session)
        expect(session.transcontinentalLineToggle).toEqual({ shown: false })
        expect(session.showsTranscontinentalLine).toBe(false)
    })

    it('starts hidden once claimed; a press shows the line and another hides it', async () => {
        const session = await inReach()
        await claim(session)
        expect(session.showsTranscontinentalLine).toBe(false)
        session.toggleTranscontinentalLine()
        expect(session.transcontinentalLineToggle).toEqual({ shown: true })
        expect(session.showsTranscontinentalLine).toBe(true)
        session.toggleTranscontinentalLine()
        expect(session.transcontinentalLineToggle).toEqual({ shown: false })
        expect(session.showsTranscontinentalLine).toBe(false)
    })

    it('keeps the choice across new Game States and in History View', async () => {
        const session = await inReach()
        await claim(session)
        session.toggleTranscontinentalLine()
        const another = session.boardOffer.lit[0]
        assertExists(another)
        await session.placeLocomotive(another.placements[0].railroadId, another.hexId)
        await settled(session)
        expect(session.showsTranscontinentalLine).toBe(true)

        // Before the claim History View offers no toggle; after it the line follows the choice.
        await vi.waitFor(async () => {
            await session.history.goToPreviousAction()
            expect(session.isViewingHistory).toBe(true)
        })
        await settled(session)
        expect(session.gameState.transcontinental).toBeDefined()
        expect(session.showsTranscontinentalLine).toBe(true)
        await vi.waitFor(async () => {
            await session.history.goToPreviousAction()
            expect(session.gameState.transcontinental).toBeUndefined()
        })
        await settled(session)
        expect(session.transcontinentalLineToggle).toBeUndefined()
        expect(session.showsTranscontinentalLine).toBe(false)
        await vi.waitFor(async () => {
            await session.history.goToNextAction()
            expect(session.gameState.transcontinental).toBeDefined()
        })
        await settled(session)
        expect(session.transcontinentalLineToggle).toEqual({ shown: true })
        session.toggleTranscontinentalLine()
        expect(session.showsTranscontinentalLine).toBe(false)
    })
})

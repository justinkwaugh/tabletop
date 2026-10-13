import { assertExists } from '@tabletop/common'
import {
    MAX_FRENCH_DETACHMENTS,
    Side,
    UnitType,
    setupLocaleOf,
    type Detachment,
    type Face,
    type HydratedNapoleonsTriumphGameState,
    type Position
} from '@tabletop/napoleons-triumph'
import {
    advanceGuardStillToChoose,
    choosesAdvanceGuard,
    corpsOf,
    corpsStrengths,
    detachedOtherThanTheBattery,
    detachedPosts,
    detachmentsUsed,
    fits,
    fixedBatteryPost,
    fixedBatteryPosts,
    onMapStartOf,
    postStances,
    setupProblem,
    stanceTargets,
    unassignedStacks,
    withCorpsStance,
    withFixedBatteryPosted,
    withUnitDetached,
    withUnitJoining,
    type ArmySetup,
    type CorpsStrength,
    type OnMapStart,
    type SetupTarget
} from './armySetup.js'
import { DestinationKind, type SetupDestination, type SetupStep } from './setupSelection.js'
import { TargetKind, type ReserveTarget } from './targets.js'

export interface PoolStack {
    face: Face
    count: number
    nextUnitId?: string
    offered: boolean
    held: boolean
}

export interface CorpsSeat extends CorpsStrength {
    open: boolean
    /** Set only where the player chooses which corps start on the map. */
    onMapStart?: OnMapStart
}

export interface DetachedSeat {
    unitIds: string[]
    room: number
    open: boolean
    heldAtItsPost?: Detachment
}

export interface FixedBatterySeat {
    unitId?: string
    position?: Position
    open: boolean
    /** Table ruling: with the Santon rule in use the fixed battery stands on the Santon and stays there. */
    holdsTheSanton: boolean
}

export interface SetupTable {
    stacks: PoolStack[]
    unassigned: number
    corps: CorpsSeat[]
    corpsStillToStartOnMap: number
    detached?: DetachedSeat
    fixedBattery?: FixedBatterySeat
    problem?: string
}

type SeatOfUnitsApart = DestinationKind.Detached | DestinationKind.FixedBattery

interface PlacingApart {
    takes(
        state: HydratedNapoleonsTriumphGameState,
        playerId: string,
        setup: ArmySetup,
        face: Face
    ): boolean
    posts(
        state: HydratedNapoleonsTriumphGameState,
        playerId: string,
        setup: ArmySetup,
        unitId: string
    ): ReserveTarget[]
    standing(setup: ArmySetup, unitId: string, position: Position): ArmySetup
}

const PLACING_APART: Record<SeatOfUnitsApart, PlacingApart> = {
    [DestinationKind.Detached]: {
        takes: (state, playerId, setup) =>
            detachmentsUsed(state, playerId, setup) < MAX_FRENCH_DETACHMENTS,
        posts: detachedPosts,
        standing: withUnitDetached
    },
    [DestinationKind.FixedBattery]: {
        takes: (_state, _playerId, setup, face) =>
            face.type === UnitType.Artillery && setup.fixedBatteryId === undefined,
        posts: fixedBatteryPosts,
        standing: withFixedBatteryPosted
    }
}

export function firstDestination(setup: ArmySetup): SetupDestination {
    const [first] = setup.corps
    assertExists(first, 'An army has commanders')
    return { kind: DestinationKind.Corps, commanderId: first.commanderId }
}

/** The fixed battery stays in hand for as long as its seat is open: it still has to be given an approach, or may be turned to another. */
export function unitInHand({ setup, open, heldUnitId }: SetupStep): string | undefined {
    return (
        heldUnitId ??
        (open.kind === DestinationKind.FixedBattery ? fixedBatteryPost(setup)?.unitId : undefined)
    )
}

export function unitsOfOpenSeat(step: SetupStep): string[] {
    const { setup, open } = step
    if (open.kind === DestinationKind.Corps) {
        return corpsOf(setup, open.commanderId).unitIds
    }
    const inHand = unitInHand(step)
    if (inHand !== undefined) {
        return [inHand]
    }
    return open.kind === DestinationKind.Detached
        ? detachedOtherThanTheBattery(setup).map((entry) => entry.unitId)
        : []
}

function opensCorps(open: SetupDestination, commanderId: string): boolean {
    return open.kind === DestinationKind.Corps && open.commanderId === commanderId
}

export function placedStraightFromPool(
    { setup, open }: SetupStep,
    unitId: string
): ArmySetup | undefined {
    return open.kind === DestinationKind.Corps
        ? withUnitJoining(setup, unitId, open.commanderId)
        : undefined
}

function takesFromPool(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    { setup, open }: SetupStep,
    face: Face
): boolean {
    return (
        open.kind === DestinationKind.Corps ||
        PLACING_APART[open.kind].takes(state, playerId, setup, face)
    )
}

export function setupTable(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    step: SetupStep
): SetupTable {
    const { setup, open, heldUnitId } = step
    const side = state.sideOf(playerId)
    const stacks = unassignedStacks(state, playerId, setup).map(({ face, unitIds }) => {
        const [nextUnitId] = unitIds
        const placed =
            nextUnitId === undefined ? undefined : placedStraightFromPool(step, nextUnitId)
        return {
            face,
            count: unitIds.length,
            nextUnitId,
            offered:
                nextUnitId !== undefined &&
                takesFromPool(state, playerId, step, face) &&
                (placed === undefined || fits(state, playerId, placed)),
            held: heldUnitId !== undefined && unitIds.includes(heldUnitId)
        }
    })
    const unassigned = stacks.reduce((sum, stack) => sum + stack.count, 0)
    const table: SetupTable = {
        stacks,
        unassigned,
        corps: corpsStrengths(state, playerId, setup).map((strength) => ({
            ...strength,
            open: opensCorps(open, strength.commanderId),
            onMapStart: choosesAdvanceGuard(state, side)
                ? onMapStartOf(state, playerId, setup, strength.commanderId)
                : undefined
        })),
        corpsStillToStartOnMap: advanceGuardStillToChoose(state, playerId, setup),
        problem: unassigned === 0 ? setupProblem(state, playerId, setup) : undefined
    }
    if (side !== Side.French) {
        return table
    }
    const battery = fixedBatteryPost(setup)
    const detached = detachedOtherThanTheBattery(setup)
    return {
        ...table,
        detached: {
            unitIds: detached.map((entry) => entry.unitId),
            room: MAX_FRENCH_DETACHMENTS - detachmentsUsed(state, playerId, setup),
            open: open.kind === DestinationKind.Detached,
            heldAtItsPost: detached.find((entry) => entry.unitId === heldUnitId)
        },
        fixedBattery: {
            unitId: battery?.unitId,
            position: battery?.position,
            open: open.kind === DestinationKind.FixedBattery,
            holdsTheSanton: state.santon
        }
    }
}

export function setupTargets(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    step: SetupStep
): SetupTarget[] {
    const { setup, open } = step
    // Turning a corps or the fixed battery can make the battery one of the six detachments, so a turn is offered only where the set-up still fits.
    const stillFitting = (targets: SetupTarget[]) =>
        targets.filter((target) => fits(state, playerId, withTargetChosen(step, target)))
    if (open.kind === DestinationKind.Corps) {
        return stillFitting(stanceTargets(state.map, setup, open.commanderId))
    }
    const unitId = unitInHand(step)
    if (unitId === undefined) {
        return []
    }
    if (setup.detached.some((entry) => entry.unitId === unitId)) {
        return state.santon && setup.fixedBatteryId === unitId
            ? []
            : stillFitting(postStances(state.map, setup, unitId))
    }
    return PLACING_APART[open.kind].posts(state, playerId, setup, unitId)
}

export function withTargetChosen(step: SetupStep, target: SetupTarget): ArmySetup {
    const { setup, open } = step
    if (open.kind === DestinationKind.Corps) {
        return withCorpsStance(
            setup,
            open.commanderId,
            target.kind === TargetKind.Approach ? target.position.approach : undefined
        )
    }
    const unitId = unitInHand(step)
    assertExists(unitId, 'A place on the map is offered for the unit in hand')
    return PLACING_APART[open.kind].standing(setup, unitId, target.position)
}

export function seatOfUnitApart(setup: ArmySetup, unitId: string): SetupDestination {
    return setup.fixedBatteryId === unitId
        ? { kind: DestinationKind.FixedBattery }
        : { kind: DestinationKind.Detached }
}

export interface SetupLocale {
    commanderId: string
    locale: number
    open: boolean
    empty: boolean
}

export function setupLocales(
    state: HydratedNapoleonsTriumphGameState,
    { setup, open }: SetupStep
): SetupLocale[] {
    return setup.corps
        .filter((corps) => !corps.offMap)
        .map((corps) => ({
            commanderId: corps.commanderId,
            locale: setupLocaleOf(state.map, corps.commanderId).id,
            open: opensCorps(open, corps.commanderId),
            empty: corps.unitIds.length === 0
        }))
}

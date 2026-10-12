import { assertExists } from '@tabletop/common'
import {
    MAX_FRENCH_DETACHMENTS,
    Side,
    UnitType,
    type Detachment,
    type Face,
    type HydratedNapoleonsTriumphGameState,
    type Position
} from '@tabletop/napoleons-triumph'
import {
    choosesAdvanceGuard,
    corpsCards,
    detachedPosts,
    detachmentsUsed,
    fits,
    fixedBatteryPosts,
    mayStartOnMap,
    postStances,
    setupLocaleOf,
    setupProblem,
    stanceTargets,
    unassignedStacks,
    withCorpsStance,
    withFixedBatteryOnTheSanton,
    withFixedBatteryPosted,
    withUnitDetached,
    withUnitJoining,
    type ArmySetup,
    type CorpsCard
} from './armySetup.js'
import { DestinationKind, type SetupDestination, type SetupStep } from './setupSelection.js'
import { TargetKind, type ApproachTarget, type ReserveTarget } from './targets.js'

export interface PoolStack {
    face: Face
    count: number
    nextUnitId?: string
    offered: boolean
    held: boolean
}

export interface CorpsSeat extends CorpsCard {
    open: boolean
    /** Set only where the player chooses which corps start on the map. */
    mayStartOnMap?: boolean
}

export interface DetachedSeat {
    unitIds: string[]
    room: number
    open: boolean
    /** The detached unit in hand and where it stands, once it has been given a place. */
    held?: Detachment
}

export interface FixedBatterySeat {
    unitId?: string
    position?: Position
    open: boolean
}

export interface SetupTable {
    stacks: PoolStack[]
    unassigned: number
    corps: CorpsSeat[]
    detached?: DetachedSeat
    fixedBattery?: FixedBatterySeat
    problem?: string
}

export function firstDestination(setup: ArmySetup): SetupDestination {
    const [first] = setup.corps
    assertExists(first, 'An army has commanders')
    return { kind: DestinationKind.Corps, commanderId: first.commanderId }
}

/** The unit the map is placing: the one taken in hand, or the fixed battery for as long as its seat is open, since it still has to be given an approach or may be turned to another. */
export function unitInHand({ setup, open, heldUnitId }: SetupStep): string | undefined {
    const standingBattery = setup.detached.find((entry) => entry.unitId === setup.fixedBatteryId)
    return (
        heldUnitId ??
        (open.kind === DestinationKind.FixedBattery ? standingBattery?.unitId : undefined)
    )
}

/** The units of the open seat that stand on the map: the open corps, the fixed battery, or the detached units, of which only the one in hand counts while one is. */
export function unitsOfOpenSeat(step: SetupStep): string[] {
    const { setup, open } = step
    if (open.kind === DestinationKind.Corps) {
        return setup.corps.find((corps) => corps.commanderId === open.commanderId)?.unitIds ?? []
    }
    const inHand = unitInHand(step)
    if (inHand !== undefined) {
        return [inHand]
    }
    return open.kind === DestinationKind.Detached
        ? setup.detached
              .map((entry) => entry.unitId)
              .filter((unitId) => unitId !== setup.fixedBatteryId)
        : []
}

function opensCorps(open: SetupDestination, commanderId: string): boolean {
    return open.kind === DestinationKind.Corps && open.commanderId === commanderId
}

/** Where a unit tapped in the pool ends up at once, or nothing when it has to be shown its place on the map first. */
export function placedFromPool(
    state: HydratedNapoleonsTriumphGameState,
    { setup, open }: SetupStep,
    unitId: string
): ArmySetup | undefined {
    if (open.kind === DestinationKind.Corps) {
        return withUnitJoining(setup, unitId, open.commanderId)
    }
    return open.kind === DestinationKind.FixedBattery && state.santon
        ? withFixedBatteryOnTheSanton(setup, unitId)
        : undefined
}

function takesFromPool(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    { setup, open }: SetupStep,
    face: Face
): boolean {
    switch (open.kind) {
        case DestinationKind.Corps:
            return true
        case DestinationKind.Detached:
            return detachmentsUsed(state, playerId, setup) < MAX_FRENCH_DETACHMENTS
        case DestinationKind.FixedBattery:
            return face.type === UnitType.Artillery && setup.fixedBatteryId === undefined
    }
}

export function setupTable(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    step: SetupStep
): SetupTable {
    const { setup, open, heldUnitId } = step
    const side = state.sideOf(playerId)
    const cards = corpsCards(state, playerId, setup)
    const stacks = unassignedStacks(state, playerId, setup).map(({ face, unitIds }) => {
        const [nextUnitId] = unitIds
        const placed =
            nextUnitId === undefined ? undefined : placedFromPool(state, step, nextUnitId)
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
    const corps = cards.map((card) => ({
        ...card,
        open: opensCorps(open, card.commanderId),
        mayStartOnMap: choosesAdvanceGuard(state, side)
            ? !card.offMap || mayStartOnMap(state, playerId, setup, card.commanderId)
            : undefined
    }))
    const problem = unassigned === 0 ? setupProblem(state, playerId, setup) : undefined
    if (side !== Side.French) {
        return { stacks, unassigned, corps, problem }
    }
    const battery = setup.detached.find((entry) => entry.unitId === setup.fixedBatteryId)
    return {
        stacks,
        unassigned,
        corps,
        problem,
        detached: {
            unitIds: setup.detached
                .filter((entry) => entry.unitId !== setup.fixedBatteryId)
                .map((entry) => entry.unitId),
            room: MAX_FRENCH_DETACHMENTS - detachmentsUsed(state, playerId, setup),
            open: open.kind === DestinationKind.Detached,
            held: setup.detached.find(
                (entry) => entry.unitId === heldUnitId && entry.unitId !== setup.fixedBatteryId
            )
        },
        fixedBattery: {
            unitId: battery?.unitId,
            position: battery?.position,
            open: open.kind === DestinationKind.FixedBattery
        }
    }
}

export type SetupTarget = ReserveTarget | ApproachTarget

/** What the map offers: where the open corps may stand in its own locale, a locale for the unit in hand, or once it has one, the approaches it may turn to there. */
export function setupTargets(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    step: SetupStep
): SetupTarget[] {
    const { setup, open } = step
    if (open.kind === DestinationKind.Corps) {
        return stanceTargets(state.map, setup, open.commanderId)
    }
    const unitId = unitInHand(step)
    if (unitId === undefined) {
        return []
    }
    if (setup.detached.some((entry) => entry.unitId === unitId)) {
        return state.santon && setup.fixedBatteryId === unitId
            ? []
            : postStances(state.map, setup, unitId)
    }
    return open.kind === DestinationKind.Detached
        ? detachedPosts(state, playerId, setup, unitId)
        : fixedBatteryPosts(state, playerId, setup, unitId)
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
    return open.kind === DestinationKind.Detached
        ? withUnitDetached(setup, unitId, target.position)
        : withFixedBatteryPosted(setup, unitId, target.position)
}

/** The destination a unit already standing on its own is turned from when it is tapped on the map. */
export function destinationOfPost(setup: ArmySetup, unitId: string): SetupDestination {
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

/** The set-up locales of the corps that start on the map, so each can be found and opened there before it has any units. */
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

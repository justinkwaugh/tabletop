import { assertExists } from '@tabletop/common'
import {
    ALLIED_ADVANCE_GUARD_CORPS,
    MAX_CORPS_UNITS,
    MAX_FRENCH_DETACHMENTS,
    SANTON_LOCALE,
    STARTING_ARMIES,
    Scenario,
    Side,
    UnitType,
    commanderDefinition,
    commandersOf,
    deployArmy,
    faceOf,
    hasUnitOtherThanLineInfantry,
    isGuard,
    isLegal,
    sameFace,
    setupLocaleOf,
    validateDetachedPosition,
    whyIllegal,
    type BattleMap,
    type Deployment,
    type Detachment,
    type Face,
    type HydratedNapoleonsTriumphGameState,
    type Position
} from '@tabletop/napoleons-triumph'
import { leftToRightFromOwnLines } from '$lib/utils/seatOrder.js'
import { UNIT_TYPE_ORDER } from '$lib/utils/unitTypeOrder.js'
import { copyOf } from './stateCopy.js'
import {
    approachTarget,
    reserveTarget,
    type ApproachTarget,
    type ReserveTarget
} from './targets.js'

export type SetupTarget = ReserveTarget | ApproachTarget

export interface CorpsSetup {
    commanderId: string
    unitIds: string[]
    approach?: number
    offMap: boolean
}

/** Rule 6 has every detached unit come from a commander; here the player says only where units stand, and which commander that was is worked out. */
export interface ArmySetup {
    corps: CorpsSetup[]
    detached: Detachment[]
    fixedBatteryId?: string
}

/** Rule 6, step 6: on 1 December the Allied player picks the two corps that start on the map. */
export function choosesAdvanceGuard(state: HydratedNapoleonsTriumphGameState, side: Side): boolean {
    return side === Side.Allied && state.scenario === Scenario.December1
}

/** The French batteries are all alike, so which of them holds the Santon is no choice of the player's. */
function batteryForTheSanton(state: HydratedNapoleonsTriumphGameState, playerId: string): string {
    const [battery] = state
        .unitsOf(playerId)
        .filter((unit) => faceOf(unit).type === UnitType.Artillery)
        .map((unit) => unit.id)
        .toSorted()
    assertExists(battery, 'The French army has artillery')
    return battery
}

/** Table ruling: with the Santon rule in use the fixed battery stands on the Santon, in reserve, so the French set-up starts with it there. */
export function emptySetup(state: HydratedNapoleonsTriumphGameState, playerId: string): ArmySetup {
    const side = state.sideOf(playerId)
    const heldBack = choosesAdvanceGuard(state, side)
    const commanderIds = commandersOf(side).map((commander) => commander.id)
    const untouched: ArmySetup = {
        corps: leftToRightFromOwnLines(state.map, side, commanderIds).map((commanderId) => ({
            commanderId,
            unitIds: [],
            offMap: heldBack || commanderDefinition(commanderId).reinforcement === true
        })),
        detached: []
    }
    return side === Side.French && state.santon
        ? withFixedBatteryPosted(untouched, batteryForTheSanton(state, playerId), {
              locale: SANTON_LOCALE
          })
        : untouched
}

export function corpsOf(setup: ArmySetup, commanderId: string): CorpsSetup {
    const corps = setup.corps.find((entry) => entry.commanderId === commanderId)
    assertExists(corps, `${commanderId} leads no corps of the set-up`)
    return corps
}

export function seatedInACorps(setup: ArmySetup, unitId: string): boolean {
    return setup.corps.some((corps) => corps.unitIds.includes(unitId))
}

export function fixedBatteryPost(setup: ArmySetup): Detachment | undefined {
    return setup.detached.find((entry) => entry.unitId === setup.fixedBatteryId)
}

export function detachedOtherThanTheBattery(setup: ArmySetup): Detachment[] {
    return setup.detached.filter((entry) => entry.unitId !== setup.fixedBatteryId)
}

function withCorps(
    setup: ArmySetup,
    commanderId: string,
    change: (corps: CorpsSetup) => CorpsSetup
): ArmySetup {
    return {
        ...setup,
        corps: setup.corps.map((corps) =>
            corps.commanderId === commanderId ? change(corps) : corps
        )
    }
}

export function withUnitReturned(setup: ArmySetup, unitId: string): ArmySetup {
    return {
        corps: setup.corps.map((corps) => ({
            ...corps,
            unitIds: corps.unitIds.filter((id) => id !== unitId)
        })),
        detached: setup.detached.filter((entry) => entry.unitId !== unitId),
        fixedBatteryId: setup.fixedBatteryId === unitId ? undefined : setup.fixedBatteryId
    }
}

export function withUnitJoining(setup: ArmySetup, unitId: string, commanderId: string): ArmySetup {
    return withCorps(withUnitReturned(setup, unitId), commanderId, (corps) => ({
        ...corps,
        unitIds: [...corps.unitIds, unitId]
    }))
}

export function withUnitDetached(setup: ArmySetup, unitId: string, position: Position): ArmySetup {
    const returned = withUnitReturned(setup, unitId)
    return { ...returned, detached: [...returned.detached, { unitId, position }] }
}

export function withFixedBatteryPosted(
    setup: ArmySetup,
    unitId: string,
    position: Position
): ArmySetup {
    const cleared =
        setup.fixedBatteryId === undefined ? setup : withUnitReturned(setup, setup.fixedBatteryId)
    return { ...withUnitDetached(cleared, unitId, position), fixedBatteryId: unitId }
}

export function withCorpsStance(
    setup: ArmySetup,
    commanderId: string,
    approach: number | undefined
): ArmySetup {
    return withCorps(setup, commanderId, ({ commanderId: id, unitIds, offMap }) =>
        approach === undefined
            ? { commanderId: id, unitIds, offMap }
            : { commanderId: id, unitIds, offMap, approach }
    )
}

export function withCorpsOnMap(setup: ArmySetup, commanderId: string, onMap: boolean): ArmySetup {
    return withCorps(setup, commanderId, ({ commanderId: id, unitIds }) => ({
        commanderId: id,
        unitIds,
        offMap: !onMap
    }))
}

type CorpsSizes = ReadonlyMap<string, number>

function sizesOf(setup: ArmySetup): Map<string, number> {
    return new Map(setup.corps.map((corps) => [corps.commanderId, corps.unitIds.length]))
}

function sizeIn(sizes: CorpsSizes, commanderId: string): number {
    const size = sizes.get(commanderId)
    assertExists(size, `${commanderId} leads no corps of the set-up`)
    return size
}

/** The commander a unit standing on its own counts as coming from. The fixed battery may be no detachment at all (rule 6, step 9), and on the approach its corps blocks it stands in the corps. */
export interface Credit {
    unitId: string
    commanderId: string
    isDetachment: boolean
    standsWithCorps: boolean
}

function creditChoices(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup,
    { unitId, position }: Detachment
): Credit[] {
    const map = state.map
    const isBattery = setup.fixedBatteryId === unitId && !state.santon
    return setup.corps
        .filter((corps) => !corps.offMap)
        .flatMap((corps) => {
            const { commanderId } = corps
            const home = setupLocaleOf(map, commanderId).id
            const standsWithCorps = corps.approach === position.approach
            // Rule 6, step 9 repositions the battery "if it is in reserve": from an approach its corps blocks, another approach takes one of the six detachments. A battery not yet given its approach is still to be repositioned.
            const repositioned = corps.approach === undefined || position.approach === undefined
            if (isBattery && home === position.locale && (standsWithCorps || repositioned)) {
                return [{ unitId, commanderId, isDetachment: false, standsWithCorps, steps: 0 }]
            }
            return isLegal(() => validateDetachedPosition(state, playerId, commanderId, position))
                ? [
                      {
                          unitId,
                          commanderId,
                          isDetachment: true,
                          standsWithCorps: false,
                          steps: map.distance(home, position.locale) ?? 0
                      }
                  ]
                : []
        })
        .toSorted((a, b) => a.steps - b.steps)
        .map(({ steps: _steps, ...credit }) => credit)
}

/** Rule 8: a corps is never just a commander, so a corps with no unit standing with it still needs one, whatever is detached from it. */
function unitsStillNeeded(commanderId: string, staying: number, credits: Credit[]): number {
    const standing = staying + credits.filter((credit) => credit.standsWithCorps).length
    const shortOfMinimum = commanderDefinition(commanderId).minimumUnits - staying - credits.length
    return Math.max(shortOfMinimum, standing === 0 ? 1 : 0)
}

function creditsTo(credits: readonly Credit[], commanderId: string): Credit[] {
    return credits.filter((credit) => credit.commanderId === commanderId)
}

function unitsPlaced(setup: ArmySetup): string[] {
    return [
        ...setup.corps.flatMap((corps) => corps.unitIds),
        ...setup.detached.map((entry) => entry.unitId)
    ]
}

interface CreditProblem {
    setup: ArmySetup
    choices: Credit[][]
    stillToPlace: number
}

function creditProblemOf(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): CreditProblem {
    return {
        setup,
        choices: setup.detached.map((entry) => creditChoices(state, playerId, setup, entry)),
        stillToPlace: state.unitsOf(playerId).length - unitsPlaced(setup).length
    }
}

function mayCredit(
    choice: Credit,
    sizes: CorpsSizes,
    chosen: readonly Credit[],
    detachments: number
): boolean {
    const held = sizeIn(sizes, choice.commanderId) + creditsTo(chosen, choice.commanderId).length
    return (
        held < MAX_CORPS_UNITS &&
        detachments + Number(choice.isDetachment) <= MAX_FRENCH_DETACHMENTS
    )
}

function detachmentsAmong(credits: readonly Credit[]): number {
    return credits.filter((credit) => credit.isDetachment).length
}

function canBeCredited({ choices }: CreditProblem, sizes: CorpsSizes): boolean {
    const chosen: Credit[] = []
    const creditedFrom = (index: number): boolean =>
        index === choices.length ||
        choices[index].some((choice) => {
            if (!mayCredit(choice, sizes, chosen, detachmentsAmong(chosen))) {
                return false
            }
            chosen.push(choice)
            const credited = creditedFrom(index + 1)
            chosen.pop()
            return credited
        })
    return creditedFrom(0)
}

const UNMEETABLE_SHORTFALL_COST = 10000
const DETACHMENT_COST = 100

function cheapestDetachmentsFrom(choices: Credit[][]): number[] {
    const cheapest = [0]
    for (const options of choices.toReversed()) {
        const free = options.some((choice) => !choice.isDetachment)
        cheapest.unshift(cheapest[0] + (free ? 0 : DETACHMENT_COST))
    }
    return cheapest
}

/** Detached units count as coming from the nearest commander that can take them, and from another only where that is what lets every corps reach its minimum with the units still to place. */
function bestCredits(
    { setup, choices, stillToPlace }: CreditProblem,
    sizes: CorpsSizes
): Credit[] | undefined {
    const cheapestRest = cheapestDetachmentsFrom(choices)
    const chosen: Credit[] = []
    let best: { cost: number; credits: Credit[] } | undefined
    const costOfChosen = (spent: number): number => {
        const shortfall = setup.corps.reduce(
            (sum, { commanderId }) =>
                sum +
                unitsStillNeeded(
                    commanderId,
                    sizeIn(sizes, commanderId),
                    creditsTo(chosen, commanderId)
                ),
            0
        )
        return Math.max(0, shortfall - stillToPlace) * UNMEETABLE_SHORTFALL_COST + spent
    }
    const search = (index: number, preferenceCost: number) => {
        const detachments = detachmentsAmong(chosen)
        const spent = detachments * DETACHMENT_COST + preferenceCost
        if (best !== undefined && spent + cheapestRest[index] >= best.cost) {
            return
        }
        if (index === choices.length) {
            const cost = costOfChosen(spent)
            if (best === undefined || cost < best.cost) {
                best = { cost, credits: [...chosen] }
            }
            return
        }
        choices[index].forEach((choice, preference) => {
            if (mayCredit(choice, sizes, chosen, detachments)) {
                chosen.push(choice)
                search(index + 1, preferenceCost + preference)
                chosen.pop()
            }
        })
    }
    search(0, 0)
    return best?.credits
}

function unitsStandingIn(
    map: BattleMap,
    setup: ArmySetup,
    sizes: CorpsSizes,
    locale: number
): number {
    const withCorps = setup.corps
        .filter((corps) => !corps.offMap && setupLocaleOf(map, corps.commanderId).id === locale)
        .reduce((sum, corps) => sum + sizeIn(sizes, corps.commanderId), 0)
    return withCorps + setup.detached.filter((entry) => entry.position.locale === locale).length
}

function fitsWith(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    problem: CreditProblem,
    sizes: CorpsSizes
): boolean {
    const map = state.map
    const { setup } = problem
    const onMap = setup.corps.filter((corps) => !corps.offMap)
    const side = state.sideOf(playerId)
    const heldLocales = new Set([
        ...onMap.map((corps) => setupLocaleOf(map, corps.commanderId).id),
        ...setup.detached.map((entry) => entry.position.locale)
    ])
    return (
        setup.corps.every((corps) => sizeIn(sizes, corps.commanderId) <= MAX_CORPS_UNITS) &&
        (!choosesAdvanceGuard(state, side) || onMap.length <= ALLIED_ADVANCE_GUARD_CORPS) &&
        [...heldLocales].every(
            (locale) => unitsStandingIn(map, setup, sizes, locale) <= map.locale(locale).capacity
        ) &&
        canBeCredited(problem, sizes)
    )
}

/** Rule 6, step 7: a reinforcement corps with nothing but two-strength infantry so far. */
function needsOtherKind(state: HydratedNapoleonsTriumphGameState, corps: CorpsSetup): boolean {
    return (
        commanderDefinition(corps.commanderId).reinforcement === true &&
        !hasUnitOtherThanLineInfantry(state, corps.unitIds)
    )
}

function leavesRoomForTheOtherKind(
    state: HydratedNapoleonsTriumphGameState,
    setup: ArmySetup
): boolean {
    return setup.corps.every(
        (corps) => corps.unitIds.length < MAX_CORPS_UNITS || !needsOtherKind(state, corps)
    )
}

/** Maximums only: eight units to a commander, seven of them two-strength infantry where another kind is required, the capacity of each locale, six detachments. Minimums are what is still to do. */
export function fits(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): boolean {
    return (
        leavesRoomForTheOtherKind(state, setup) &&
        fitsWith(state, playerId, creditProblemOf(state, playerId, setup), sizesOf(setup))
    )
}

function roomIn(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    problem: CreditProblem,
    commanderId: string
): number {
    const sizes = sizesOf(problem.setup)
    const size = sizeIn(sizes, commanderId)
    let room = 0
    while (
        size + room < MAX_CORPS_UNITS &&
        fitsWith(state, playerId, problem, new Map(sizes).set(commanderId, size + room + 1))
    ) {
        room++
    }
    return room
}

export enum RoomLimit {
    Corps = 'Corps',
    Locale = 'Locale',
    /** Rule 6, steps 7 and 8: the eight of a corps count the units detached from it. */
    CorpsWithDetached = 'CorpsWithDetached'
}

export interface CorpsStrength {
    commanderId: string
    unitIds: string[]
    stillNeeded: number
    /** Rule 6, step 7: a reinforcement corps with nothing but two-strength infantry so far. */
    needsOtherKind: boolean
    /** Rule 6, steps 7 and 8: the corps stands below its minimum, which is met by units that were detached from it. */
    minimumMetByDetached: boolean
    room: number
    fullBecause?: RoomLimit
    offMap: boolean
    approach?: number
}

function limitOn(map: BattleMap, setup: ArmySetup, corps: CorpsSetup): RoomLimit {
    if (corps.unitIds.length >= MAX_CORPS_UNITS || corps.offMap) {
        return RoomLimit.Corps
    }
    const home = setupLocaleOf(map, corps.commanderId)
    const standing = unitsStandingIn(map, setup, sizesOf(setup), home.id)
    return standing >= home.capacity ? RoomLimit.Locale : RoomLimit.CorpsWithDetached
}

function stillNeededBy(
    state: HydratedNapoleonsTriumphGameState,
    corps: CorpsSetup,
    credited: Credit[]
): number {
    return Math.max(
        unitsStillNeeded(corps.commanderId, corps.unitIds.length, credited),
        Number(needsOtherKind(state, corps))
    )
}

/** A corps asks the pool for its whole minimum. Detached units are counted towards it only once the pool cannot fill every corps, so no detached unit is tied to a corps before it has to be. */
function creditsTowardsMinimums(
    state: HydratedNapoleonsTriumphGameState,
    problem: CreditProblem
): Credit[] {
    const neededFromThePool = problem.setup.corps.reduce(
        (sum, corps) => sum + stillNeededBy(state, corps, []),
        0
    )
    return neededFromThePool <= problem.stillToPlace ? [] : creditsIn(problem)
}

export function corpsStrengths(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): CorpsStrength[] {
    const problem = creditProblemOf(state, playerId, setup)
    const credits = creditsTowardsMinimums(state, problem)
    return setup.corps.map((corps) => {
        const { commanderId, unitIds } = corps
        const stillNeeded = stillNeededBy(state, corps, creditsTo(credits, commanderId))
        const room = roomIn(state, playerId, problem, commanderId)
        return {
            commanderId,
            unitIds,
            stillNeeded,
            needsOtherKind: needsOtherKind(state, corps),
            minimumMetByDetached:
                stillNeeded === 0 && unitIds.length < commanderDefinition(commanderId).minimumUnits,
            room,
            fullBecause: room === 0 ? limitOn(state.map, setup, corps) : undefined,
            offMap: corps.offMap,
            approach: corps.approach
        }
    })
}

function creditsIn(problem: CreditProblem): Credit[] {
    const credits = bestCredits(problem, sizesOf(problem.setup))
    assertExists(credits, 'Every detached unit of a set-up comes from a commander within reach')
    return credits
}

export function creditsOf(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): Credit[] {
    return creditsIn(creditProblemOf(state, playerId, setup))
}

export function detachmentsUsed(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): number {
    return detachmentsAmong(creditsOf(state, playerId, setup))
}

/** Rule 6, step 6: whether a corps held off the map could be one of the two that start on it, and if not, why. */
export enum OnMapStart {
    Offered = 'Offered',
    TwoChosen = 'TwoChosen',
    TooManyUnits = 'TooManyUnits'
}

export function onMapStartOf(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup,
    commanderId: string
): OnMapStart {
    const corps = corpsOf(setup, commanderId)
    if (!corps.offMap || fits(state, playerId, withCorpsOnMap(setup, commanderId, true))) {
        return OnMapStart.Offered
    }
    const onMap = setup.corps.filter((entry) => !entry.offMap).length
    return onMap >= ALLIED_ADVANCE_GUARD_CORPS ? OnMapStart.TwoChosen : OnMapStart.TooManyUnits
}

/** Rule 6, step 6: how many of the two corps that start on the map the Allied player has still to choose on 1 December. */
export function advanceGuardStillToChoose(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): number {
    return choosesAdvanceGuard(state, state.sideOf(playerId))
        ? ALLIED_ADVANCE_GUARD_CORPS - setup.corps.filter((corps) => !corps.offMap).length
        : 0
}

export interface UnitStack {
    face: Face
    unitIds: string[]
}

function byRank(a: Face, b: Face): number {
    return (
        UNIT_TYPE_ORDER.indexOf(a.type) - UNIT_TYPE_ORDER.indexOf(b.type) ||
        Number(isGuard(b)) - Number(isGuard(a)) ||
        b.strength - a.strength
    )
}

export function unassignedStacks(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): UnitStack[] {
    const placed = new Set(unitsPlaced(setup))
    const unassigned = state
        .unitsOf(playerId)
        .filter((unit) => !placed.has(unit.id))
        .toSorted((a, b) => a.id.localeCompare(b.id))
    const faces = STARTING_ARMIES[state.sideOf(playerId)]
        .filter((face, index, all) => all.findIndex((other) => sameFace(other, face)) === index)
        .toSorted(byRank)
    return faces.map((face) => ({
        face,
        unitIds: unassigned.filter((unit) => sameFace(faceOf(unit), face)).map((unit) => unit.id)
    }))
}

function stancesIn(
    map: BattleMap,
    locale: number,
    blocked: number | undefined,
    mayStandBack: boolean
): SetupTarget[] {
    const approaches = map
        .passableApproachesOf(locale)
        .filter((approach) => approach.id !== blocked)
        .map((approach) => approachTarget({ locale, approach: approach.id }))
    return mayStandBack ? [reserveTarget(locale), ...approaches] : approaches
}

/** Rule 6: a corps sets up in its own locale, in reserve or blocking one of its approaches. */
export function stanceTargets(
    map: BattleMap,
    setup: ArmySetup,
    commanderId: string
): SetupTarget[] {
    const corps = corpsOf(setup, commanderId)
    return corps.offMap
        ? []
        : stancesIn(
              map,
              setupLocaleOf(map, commanderId).id,
              corps.approach,
              corps.approach !== undefined
          )
}

function localesToStandIn(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    standingIn: (locale: number) => ArmySetup
): ReserveTarget[] {
    return state.map.allLocales
        .filter((locale) => fits(state, playerId, standingIn(locale.id)))
        .map((locale) => reserveTarget(locale.id))
}

/** Rule 6, step 8: the locales a unit may be set up in on its own. It starts in reserve there and may then block an approach. */
export function detachedPosts(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup,
    unitId: string
): ReserveTarget[] {
    return localesToStandIn(state, playerId, (locale) =>
        withUnitDetached(setup, unitId, { locale })
    )
}

/** Rule 6, step 9: the locales the fixed battery may stand in, which have to give it an approach to block. With the Santon rule in use it stands on the Santon from the start and is never placed. */
export function fixedBatteryPosts(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup,
    unitId: string
): ReserveTarget[] {
    return localesToStandIn(state, playerId, (locale) =>
        withFixedBatteryPosted(setup, unitId, { locale })
    ).filter(({ position }) => state.map.passableApproachesOf(position.locale).length > 0)
}

/** Rule 6, steps 8 and 9: a unit standing on its own may turn to any approach of its locale; the fixed battery has to block one, any other unit may also stand back in reserve. */
export function postStances(map: BattleMap, setup: ArmySetup, unitId: string): SetupTarget[] {
    const post = setup.detached.find((entry) => entry.unitId === unitId)
    assertExists(post, `${unitId} does not stand on its own`)
    const { locale, approach } = post.position
    return stancesIn(
        map,
        locale,
        approach,
        approach !== undefined && setup.fixedBatteryId !== unitId
    )
}

export function deploymentOf(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): Deployment {
    const credits = creditsOf(state, playerId, setup)
    const battery = fixedBatteryPost(setup)
    const batteryCredit = credits.find((credit) => credit.unitId === battery?.unitId)
    const deployment: Deployment = {
        corps: setup.corps.map((corps) => {
            const unitIds = [
                ...corps.unitIds,
                ...creditsTo(credits, corps.commanderId).map((credit) => credit.unitId)
            ]
            if (corps.offMap) {
                return { commanderId: corps.commanderId, unitIds, offMap: true as const }
            }
            return corps.approach === undefined
                ? { commanderId: corps.commanderId, unitIds }
                : { commanderId: corps.commanderId, unitIds, approach: corps.approach }
        }),
        detachments: setup.detached.filter((entry) =>
            credits.some((credit) => credit.unitId === entry.unitId && credit.isDetachment)
        )
    }
    if (battery && batteryCredit) {
        deployment.fixedBattery =
            batteryCredit.isDetachment || battery.position.approach === undefined
                ? { unitId: battery.unitId }
                : { unitId: battery.unitId, approach: battery.position.approach }
    }
    return deployment
}

export function setupProblem(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): string | undefined {
    // Rule 6, step 9: the engine reads a fixed battery given no approach as standing with its corps, which passes when the corps blocks one. Here the battery was put in the locale on its own, so its approach is still to be chosen.
    const battery = fixedBatteryPost(setup)
    if (battery && battery.position.approach === undefined && !state.santon) {
        return 'The fixed battery blocks an approach'
    }
    const deployment = deploymentOf(state, playerId, setup)
    return whyIllegal(() => deployArmy(copyOf(state), playerId, deployment))
}

export function arrayedArmy(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): HydratedNapoleonsTriumphGameState {
    const arrayed = copyOf(state)
    const credits = creditsOf(state, playerId, setup)
    for (const corps of setup.corps) {
        const position = corps.offMap
            ? undefined
            : { locale: setupLocaleOf(state.map, corps.commanderId).id, approach: corps.approach }
        arrayed.commander(corps.commanderId).position = position
        for (const unitId of corps.unitIds) {
            const unit = arrayed.unit(unitId)
            unit.commanderId = corps.commanderId
            unit.position = position && { ...position }
        }
    }
    for (const { unitId, position } of setup.detached) {
        const unit = arrayed.unit(unitId)
        const credit = credits.find((candidate) => candidate.unitId === unitId)
        assertExists(credit, `Detached unit ${unitId} comes from no commander`)
        unit.commanderId = credit.standsWithCorps ? credit.commanderId : undefined
        unit.position = { ...position }
        unit.fixed = setup.fixedBatteryId === unitId ? true : undefined
    }
    return arrayed
}

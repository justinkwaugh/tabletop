import { assertExists } from '@tabletop/common'
import {
    ALLIED_ADVANCE_GUARD_CORPS,
    DETACHMENT_REACH,
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
    isGuard,
    nearAlliedObjective,
    sameFace,
    whyIllegal,
    type BattleMap,
    type Deployment,
    type Detachment,
    type Face,
    type HydratedNapoleonsTriumphGameState,
    type LocaleDefinition,
    type Position
} from '@tabletop/napoleons-triumph'
import { copyOf } from './stateCopy.js'
import {
    approachTarget,
    reserveTarget,
    type ApproachTarget,
    type ReserveTarget
} from './targets.js'

export interface CorpsSetup {
    commanderId: string
    unitIds: string[]
    approach?: number
    offMap: boolean
}

/** The army as the player wants it to stand: who stays with each commander and which units stand on their own. Rule 6 has every detached unit come from a commander; which one is worked out, not asked. */
export interface ArmySetup {
    corps: CorpsSetup[]
    detached: Detachment[]
    fixedBatteryId?: string
}

const setupLocalesByMap = new WeakMap<BattleMap, Map<string, LocaleDefinition>>()

export function setupLocaleOf(map: BattleMap, commanderId: string): LocaleDefinition {
    const known = setupLocalesByMap.get(map) ?? new Map<string, LocaleDefinition>()
    setupLocalesByMap.set(map, known)
    const locale = known.get(commanderId) ?? map.setupLocale(commanderId)
    assertExists(locale, `${commanderId} has no set-up locale`)
    known.set(commanderId, locale)
    return locale
}

/** Rule 6, step 6: on 1 December the Allied player picks the two corps that start on the map. */
export function choosesAdvanceGuard(state: HydratedNapoleonsTriumphGameState, side: Side): boolean {
    return side === Side.Allied && state.scenario === Scenario.December1
}

export function emptySetup(state: HydratedNapoleonsTriumphGameState, side: Side): ArmySetup {
    const heldBack = choosesAdvanceGuard(state, side)
    return {
        corps: commandersOf(side).map((commander) => ({
            commanderId: commander.id,
            unitIds: [],
            offMap: heldBack || commander.reinforcement === true
        })),
        detached: []
    }
}

function corpsOf(setup: ArmySetup, commanderId: string): CorpsSetup {
    const corps = setup.corps.find((entry) => entry.commanderId === commanderId)
    assertExists(corps, `${commanderId} leads no corps of the set-up`)
    return corps
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

const reachByMap = new WeakMap<BattleMap, Map<number, Map<number, number>>>()

/** Rule 6, step 8: the locales within two of a commander's set-up locale, with how far each is. */
function stepsWithinReach(map: BattleMap, home: number): Map<number, number> {
    const reaches = reachByMap.get(map) ?? new Map<number, Map<number, number>>()
    reachByMap.set(map, reaches)
    const known = reaches.get(home)
    if (known) {
        return known
    }
    const reach = new Map(
        map.allLocales.flatMap((locale): [number, number][] => {
            const steps = map.distance(home, locale.id)
            return steps !== undefined && steps <= DETACHMENT_REACH ? [[locale.id, steps]] : []
        })
    )
    reaches.set(home, reach)
    return reach
}

/** The commander a unit standing on its own is counted as coming from. Rule 6, step 9 lets the fixed battery block an approach of its own set-up locale without being one of the six detachments. */
export interface Credit {
    unitId: string
    commanderId: string
    isDetachment: boolean
}

function creditChoices(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup,
    { unitId, position }: Detachment
): Credit[] {
    const map = state.map
    const mayBeDetachedHere =
        !nearAlliedObjective(state, position.locale) &&
        !state.isEnemyOccupied(position.locale, playerId)
    const aimedInPlace = setup.fixedBatteryId === unitId && !state.santon
    return setup.corps
        .filter((corps) => !corps.offMap)
        .flatMap((corps) => {
            const home = setupLocaleOf(map, corps.commanderId).id
            if (aimedInPlace && home === position.locale) {
                return [{ unitId, commanderId: corps.commanderId, isDetachment: false, steps: 0 }]
            }
            const steps = stepsWithinReach(map, home).get(position.locale)
            return mayBeDetachedHere && steps !== undefined
                ? [{ unitId, commanderId: corps.commanderId, isDetachment: true, steps }]
                : []
        })
        .toSorted((a, b) => a.steps - b.steps)
        .map(({ unitId: id, commanderId, isDetachment }) => ({
            unitId: id,
            commanderId,
            isDetachment
        }))
}

/** Rule 8: a corps is never just a commander, so an empty corps still needs a unit of its own whatever is detached from it. */
function unitsStillNeeded(commanderId: string, staying: number, credited: number): number {
    const shortOfMinimum = commanderDefinition(commanderId).minimumUnits - staying - credited
    return Math.max(shortOfMinimum, staying === 0 ? 1 : 0)
}

function unitsPlaced(setup: ArmySetup): string[] {
    return [
        ...setup.corps.flatMap((corps) => corps.unitIds),
        ...setup.detached.map((entry) => entry.unitId)
    ]
}

/** A set-up with, for each unit standing on its own, the commanders it could be counted as coming from, nearest first. */
interface SetupReading {
    setup: ArmySetup
    creditChoices: Credit[][]
    stillToPlace: number
}

function readingOf(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): SetupReading {
    return {
        setup,
        creditChoices: setup.detached.map((entry) => creditChoices(state, playerId, setup, entry)),
        stillToPlace: state.unitsOf(playerId).length - unitsPlaced(setup).length
    }
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

/** Detached units count as coming from the nearest commander that can take them, and from another only where that is what lets every corps reach its minimum with the units still to place. When all that is asked is whether the set-up can be read at all, the first reading found will do. */
function creditsWith(
    { setup, creditChoices: choices, stillToPlace }: SetupReading,
    sizes: CorpsSizes,
    anyWillDo = false
): Credit[] | undefined {
    const cheapestRest = cheapestDetachmentsFrom(choices)
    const credited = new Map<string, number>()
    const creditedTo = (commanderId: string): number => credited.get(commanderId) ?? 0
    const chosen: Credit[] = []
    let best: { cost: number; credits: Credit[] } | undefined
    const shortfall = (): number =>
        setup.corps.reduce(
            (sum, corps) =>
                sum +
                unitsStillNeeded(
                    corps.commanderId,
                    sizeIn(sizes, corps.commanderId),
                    creditedTo(corps.commanderId)
                ),
            0
        )
    const settled = (index: number, detachments: number, preferenceCost: number): boolean => {
        const spent = detachments * DETACHMENT_COST + preferenceCost
        if (best !== undefined && spent + cheapestRest[index] >= best.cost) {
            return false
        }
        if (index === choices.length) {
            const unmeetable = Math.max(0, shortfall() - stillToPlace)
            const cost = unmeetable * UNMEETABLE_SHORTFALL_COST + spent
            if (best === undefined || cost < best.cost) {
                best = { cost, credits: [...chosen] }
            }
            return anyWillDo
        }
        return choices[index].some((choice, preference) => {
            const held = sizeIn(sizes, choice.commanderId) + creditedTo(choice.commanderId)
            const used = detachments + (choice.isDetachment ? 1 : 0)
            if (held >= MAX_CORPS_UNITS || used > MAX_FRENCH_DETACHMENTS) {
                return false
            }
            credited.set(choice.commanderId, creditedTo(choice.commanderId) + 1)
            chosen.push(choice)
            const done = settled(index + 1, used, preferenceCost + preference)
            chosen.pop()
            credited.set(choice.commanderId, creditedTo(choice.commanderId) - 1)
            return done
        })
    }
    settled(0, 0, 0)
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
    reading: SetupReading,
    sizes: CorpsSizes
): boolean {
    const map = state.map
    const { setup } = reading
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
        creditsWith(reading, sizes, true) !== undefined
    )
}

/** Whether the set-up keeps within every maximum: eight units to a commander, the capacity of each locale, six detachments. Minimums are not asked for; they are what is still to do. */
export function fits(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): boolean {
    return fitsWith(state, playerId, readingOf(state, playerId, setup), sizesOf(setup))
}

function roomIn(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    reading: SetupReading,
    commanderId: string
): number {
    const sizes = sizesOf(reading.setup)
    const size = sizeIn(sizes, commanderId)
    let room = 0
    while (
        size + room < MAX_CORPS_UNITS &&
        fitsWith(state, playerId, reading, new Map(sizes).set(commanderId, size + room + 1))
    ) {
        room++
    }
    return room
}

export interface CorpsCard {
    commanderId: string
    unitIds: string[]
    /** Detached units counted as coming from this commander, shown while they are what brings the corps up to its minimum. */
    creditedIds: string[]
    stillNeeded: number
    room: number
    offMap: boolean
    approach?: number
}

export function corpsCards(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): CorpsCard[] {
    const reading = readingOf(state, playerId, setup)
    const credits = creditsIn(reading)
    return setup.corps.map((corps) => {
        const credited = credits
            .filter((credit) => credit.commanderId === corps.commanderId)
            .map((credit) => credit.unitId)
        const shortWithoutCredits = Math.max(
            0,
            commanderDefinition(corps.commanderId).minimumUnits - corps.unitIds.length
        )
        const creditedIds = credited.slice(0, shortWithoutCredits)
        return {
            commanderId: corps.commanderId,
            unitIds: corps.unitIds,
            creditedIds,
            stillNeeded: unitsStillNeeded(corps.commanderId, corps.unitIds.length, credited.length),
            room: Math.min(
                roomIn(state, playerId, reading, corps.commanderId),
                MAX_CORPS_UNITS - corps.unitIds.length - creditedIds.length
            ),
            offMap: corps.offMap,
            approach: corps.approach
        }
    })
}

function creditsIn(reading: SetupReading): Credit[] {
    const credits = creditsWith(reading, sizesOf(reading.setup))
    assertExists(credits, 'Every detached unit of a set-up comes from a commander within reach')
    return credits
}

export function creditsOf(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): Credit[] {
    return creditsIn(readingOf(state, playerId, setup))
}

export function detachmentsUsed(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): number {
    return creditsOf(state, playerId, setup).filter((credit) => credit.isDetachment).length
}

export function mayStartOnMap(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup,
    commanderId: string
): boolean {
    return fits(state, playerId, withCorpsOnMap(setup, commanderId, true))
}

export interface UnitStack {
    face: Face
    unitIds: string[]
}

const TYPE_ORDER = [UnitType.Infantry, UnitType.Cavalry, UnitType.Artillery]

function byRank(a: Face, b: Face): number {
    return (
        TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
        Number(isGuard(b)) - Number(isGuard(a)) ||
        b.strength - a.strength
    )
}

/** Units of one face are interchangeable, so those not yet placed are offered as one stack per face. */
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

/** Rule 6: a corps sets up in its own locale, in reserve or blocking one of its approaches. */
export function stanceTargets(
    map: BattleMap,
    setup: ArmySetup,
    commanderId: string
): (ReserveTarget | ApproachTarget)[] {
    const corps = corpsOf(setup, commanderId)
    if (corps.offMap) {
        return []
    }
    const locale = setupLocaleOf(map, commanderId).id
    const approaches = map
        .passableApproachesOf(locale)
        .filter((approach) => approach.id !== corps.approach)
        .map((approach) => approachTarget({ locale, approach: approach.id }))
    return corps.approach === undefined ? approaches : [reserveTarget(locale), ...approaches]
}

function localesWithinReach(map: BattleMap, setup: ArmySetup): number[] {
    const reached = setup.corps
        .filter((corps) => !corps.offMap)
        .flatMap((corps) => [
            ...stepsWithinReach(map, setupLocaleOf(map, corps.commanderId).id).keys()
        ])
    return [...new Set(reached)].toSorted((a, b) => a - b)
}

/** Rule 6, step 8: the locales a unit may be set up in on its own. It starts in reserve there and may then block an approach. */
export function detachedPosts(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup,
    unitId: string
): ReserveTarget[] {
    return localesWithinReach(state.map, setup)
        .filter((locale) => fits(state, playerId, withUnitDetached(setup, unitId, { locale })))
        .map((locale) => reserveTarget(locale))
}

/** Rule 6, step 9: the locales the fixed battery may stand in. With the Santon rule in use it stands on the Santon, which is not offered as a choice. */
export function fixedBatteryPosts(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup,
    unitId: string
): ReserveTarget[] {
    return localesWithinReach(state.map, setup)
        .filter(
            (locale) =>
                state.map.passableApproachesOf(locale).length > 0 &&
                fits(state, playerId, withFixedBatteryPosted(setup, unitId, { locale }))
        )
        .map((locale) => reserveTarget(locale))
}

/** Where a unit already standing on its own may turn within its locale: the fixed battery has to block an approach, any other unit may also stand back in reserve. */
export function postStances(
    map: BattleMap,
    setup: ArmySetup,
    unitId: string
): (ReserveTarget | ApproachTarget)[] {
    const post = setup.detached.find((entry) => entry.unitId === unitId)
    assertExists(post, `${unitId} does not stand on its own`)
    const { locale, approach: blocked } = post.position
    const approaches = map
        .passableApproachesOf(locale)
        .filter((approach) => approach.id !== blocked)
        .map((approach) => approachTarget({ locale, approach: approach.id }))
    return blocked === undefined || setup.fixedBatteryId === unitId
        ? approaches
        : [reserveTarget(locale), ...approaches]
}

/** Table ruling: with the Santon rule in use the fixed battery stands on the Santon, in reserve. */
export function withFixedBatteryOnTheSanton(setup: ArmySetup, unitId: string): ArmySetup {
    return withFixedBatteryPosted(setup, unitId, { locale: SANTON_LOCALE })
}

function standsWithItsCorps(setup: ArmySetup, credit: Credit, position: Position): boolean {
    return !credit.isDetachment && corpsOf(setup, credit.commanderId).approach === position.approach
}

export function deploymentOf(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): Deployment {
    const credits = creditsOf(state, playerId, setup)
    const battery = setup.detached.find((entry) => entry.unitId === setup.fixedBatteryId)
    const batteryCredit = credits.find((credit) => credit.unitId === battery?.unitId)
    const deployment: Deployment = {
        corps: setup.corps.map((corps) => {
            const unitIds = [
                ...corps.unitIds,
                ...credits
                    .filter((credit) => credit.commanderId === corps.commanderId)
                    .map((credit) => credit.unitId)
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

/** What still keeps the set-up from being deployed, in the rules' own words. */
export function setupProblem(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    setup: ArmySetup
): string | undefined {
    const deployment = deploymentOf(state, playerId, setup)
    return whyIllegal(() => deployArmy(copyOf(state), playerId, deployment))
}

/** The position with the army standing as set up so far; units not yet placed stay off the map. */
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
        unit.commanderId = standsWithItsCorps(setup, credit, position)
            ? credit.commanderId
            : undefined
        unit.position = { ...position }
        unit.fixed = setup.fixedBatteryId === unitId ? true : undefined
    }
    return arrayed
}

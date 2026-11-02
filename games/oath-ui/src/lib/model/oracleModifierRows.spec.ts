import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, assert, type GameAction, type Visibility } from '@tabletop/common'
import {
    ActionType,
    HydratedUseActionPower,
    isUseActionPower,
    MachineState,
    OathRevision,
    PowerChoiceKind,
    PowerTiming,
    Region,
    SearchPlay,
    UseActionPower,
    powerIndexOf,
    type HydratedOathGameState,
    type LegalPowerUse,
    type ModifierUse
} from '@tabletop/oath'
import {
    buildAction,
    openTurn,
    required,
    served,
    testPlayer,
    testState
} from '@tabletop/oath/testing'
import {
    disposeSessions,
    openSessionOn,
    tableOf,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'
import { describeAction } from './actionDescription.js'
import { withOptionPick } from './powerChoices.js'
import type { OathGameSession } from './session.svelte.js'

// Oracle: "Draw the Vision closest to the top of the world deck. Play or discard it as if you
// searched." From revision 31 its row in Use a power holds the Search's "Cards" rows above "Use":
// the Search modifiers its use accepts, declared before the draw (Law 7.4).

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const ORACLE = 'denizen.nomad.oracle'
const HORN = 'relic.cracked-horn'
const BRACKEN = 'denizen.beast.bracken'
const WOLVES = 'denizen.beast.wolves'
const ELDERS = 'denizen.nomad.elders'
const INN = 'denizen.hearth.wayside-inn'
const SUPREMACY = 'vision.supremacy'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const modifier = (cardId: string): number => powerIndexOf(cardId, PowerTiming.Modifier)
const HORN_USE: ModifierUse = { cardId: HORN, powerIndex: modifier(HORN) }
const BRACKEN_KEY = { cardId: BRACKEN, powerIndex: modifier(BRACKEN) }

/** Dana on turn at c1 (the Cradle) with Oracle there, the Cracked Horn, and Bracken faceup. */
function table(revision: OathRevision, advisers: string[] = [BRACKEN]): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 3,
                supply: 6,
                relicIds: [HORN],
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2 })
        ],
        {
            oathRevision: revision,
            machineState: MachineState.ActPhase,
            denizensBySite: { c1: [ORACLE], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } }
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [INN, SUPREMACY]
    return s
}

async function usingPowers(played: PlayedTable) {
    const session = await openSessionOn(played)
    const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
    session.chooseAction(ActionType.UseActionPower)
    return { session, sent }
}

function oracle(session: OathGameSession): LegalPowerUse {
    return required(
        session.actionPowers.powers.find((p) => p.cardId === ORACLE),
        'Oracle is listed'
    )
}

function rowsOf(session: OathGameSession) {
    return session.actionPowers.modifierRows(oracle(session))
}

const listed = (session: OathGameSession): string[] =>
    (rowsOf(session)?.listed ?? []).map((power) => power.cardId).sort()

function tapCard(session: OathGameSession, cardId: string): void {
    const rows = required(rowsOf(session), 'Oracle has its rows')
    const power = required(
        rows.listed.find((p) => p.cardId === cardId),
        `${cardId} is listed`
    )
    rows.declare(power, !rows.isDeclared(power))
}

/** Bracken's "To:" pile and its Top / Bottom, tapped as the picker taps them. */
function pickBracken(session: OathGameSession, region: Region | undefined, bottom: boolean) {
    const rows = required(rowsOf(session), 'Oracle has its rows')
    const legal = rows.choicesOf(
        required(
            rows.listed.find((p) => p.cardId === BRACKEN),
            'Bracken'
        )
    )
    let picks = rows.picksOf(BRACKEN_KEY)
    legal.forEach((choice, index) => {
        const pick = choice.options.findIndex((option) =>
            option.kind === PowerChoiceKind.Region
                ? option.region === region
                : option.kind === PowerChoiceKind.Yes && bottom
        )
        if (pick >= 0) picks = withOptionPick(picks, choice, index, pick)
    })
    rows.setPicks(BRACKEN_KEY, picks)
}

function sentUse(sent: { mock: { calls: [GameAction][] } }): UseActionPower {
    const action = sent.mock.calls[0]?.[0]
    assert(isUseActionPower(action), 'a power is used')
    return action
}

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
const views = (s: HydratedOathGameState): [string, PlayedTable][] => [
    ['the table', tableOf(s)],
    ["Dana's own view", { state: served(s, dana), actions: [] }]
]

describe("Oracle's row lists the Search modifiers its use takes (revision 31)", () => {
    for (const [name, played] of views(table(FIXED))) {
        it(`on ${name}: the Cracked Horn and Bracken are listed, and nothing starts in use`, async () => {
            const { session } = await usingPowers(played)
            expect(listed(session)).toEqual([BRACKEN, HORN])
            const rows = required(rowsOf(session), 'Oracle has its rows')
            expect(rows.isDeclared(HORN_USE)).toBe(false)
            expect(rows.isDeclared(BRACKEN_KEY)).toBe(false)
            expect(session.actionPowers.picksComplete(oracle(session))).toBe(true)
            expect(session.actionPowers.reasonCannotUse(oracle(session))).toBeUndefined()
        })

        it(`on ${name}: once the Horn is in use Bracken is hidden, and the other way round`, async () => {
            const { session } = await usingPowers(played)
            tapCard(session, HORN)
            expect(listed(session)).toEqual([HORN])
            tapCard(session, HORN)
            expect(listed(session)).toEqual([BRACKEN, HORN])
            tapCard(session, BRACKEN)
            expect(listed(session)).toEqual([BRACKEN])
            pickBracken(session, Region.Cradle, true)
            expect(listed(session)).toEqual([BRACKEN])
        })
    }

    it('the Horn in use: "Use" sends it with the use', async () => {
        const { session, sent } = await usingPowers(tableOf(table(FIXED)))
        tapCard(session, HORN)
        expect(session.actionPowers.picksComplete(oracle(session))).toBe(true)
        expect(session.actionPowers.reasonCannotUse(oracle(session))).toBeUndefined()
        await session.actionPowers.use(oracle(session))
        const action = sentUse(sent)
        expect(action).toMatchObject({ cardId: ORACLE, modifiers: [HORN_USE] })
    })

    it('Bracken in use: "Use" waits for its pile and its side, then sends them', async () => {
        const { session, sent } = await usingPowers(tableOf(table(FIXED)))
        tapCard(session, BRACKEN)
        expect(session.actionPowers.picksComplete(oracle(session))).toBe(false)
        pickBracken(session, Region.Cradle, false)
        expect(session.actionPowers.picksComplete(oracle(session))).toBe(false)
        pickBracken(session, Region.Cradle, true)
        expect(session.actionPowers.picksComplete(oracle(session))).toBe(true)
        expect(session.actionPowers.reasonCannotUse(oracle(session))).toBeUndefined()
        await session.actionPowers.use(oracle(session))
        const action = sentUse(sent)
        expect(action.modifiers).toEqual([
            {
                ...BRACKEN_KEY,
                choices: [
                    { kind: PowerChoiceKind.Region, region: Region.Cradle },
                    { kind: PowerChoiceKind.Yes }
                ]
            }
        ])
        expect(
            HydratedUseActionPower.reasonCannotUse(
                session.gameState,
                'dana',
                ORACLE,
                action.powerIndex,
                action.choices,
                action.modifiers
            )
        ).toBeUndefined()
    })

    it('nothing in use: "Use" sends no modifier', async () => {
        const { session, sent } = await usingPowers(tableOf(table(FIXED)))
        await session.actionPowers.use(oracle(session))
        expect(sentUse(sent).modifiers).toBeUndefined()
    })

    it('Undo takes back the card put in use, one tap at a time', async () => {
        const { session } = await usingPowers(tableOf(table(FIXED)))
        tapCard(session, BRACKEN)
        pickBracken(session, Region.Cradle, false)
        expect(session.actionPowers.back()).toBe(true)
        expect(rowsOf(session)?.isDeclared(BRACKEN_KEY)).toBe(true)
        expect(rowsOf(session)?.picksOf(BRACKEN_KEY).option).toEqual({})
        expect(session.actionPowers.back()).toBe(true)
        expect(rowsOf(session)?.isDeclared(BRACKEN_KEY)).toBe(false)
        expect(listed(session)).toEqual([BRACKEN, HORN])
    })
})

describe("Oracle's row before revision 31 (R-X.4)", () => {
    it('has no rows, and "Use" sends no modifier', async () => {
        const { session, sent } = await usingPowers(tableOf(table(BEFORE)))
        expect(rowsOf(session)).toBeUndefined()
        expect(session.actionPowers.picksComplete(oracle(session))).toBe(true)
        await session.actionPowers.use(oracle(session))
        expect(sentUse(sent).modifiers).toBeUndefined()
    })
})

describe('after the use, Bracken in use is not offered as the adviser discarded (R-7.4.3-H1)', () => {
    it('the Vision kept as a facedown adviser at the limit offers the Wolves and the Elders only', async () => {
        const s = table(FIXED, [BRACKEN, WOLVES, ELDERS])
        new HydratedUseActionPower(
            buildAction(UseActionPower, {
                playerId: 'dana',
                cardId: ORACLE,
                powerIndex: powerIndexOf(ORACLE, PowerTiming.Action),
                modifiers: [
                    {
                        ...BRACKEN_KEY,
                        choices: [{ kind: PowerChoiceKind.Region, region: Region.Cradle }]
                    }
                ]
            })
        ).apply(s)
        s.machineState = MachineState.Searching
        const session = await openSessionOn(tableOf(s))
        const draft = session.search
        draft.keep(SUPREMACY)
        const facedown = draft.placements.find(
            (o) => o.play === SearchPlay.Adviser && o.faceUp !== true
        )
        expect(facedown?.room?.discardable).toEqual([WOLVES, ELDERS])
    })
})

describe("History names Oracle's declared cards in brackets after the cost", () => {
    it('the Horn: "used Oracle, placing 2 secrets on it (Cracked Horn): …"', async () => {
        const s = table(FIXED)
        const use = new HydratedUseActionPower(
            buildAction(UseActionPower, {
                playerId: 'dana',
                cardId: ORACLE,
                powerIndex: powerIndexOf(ORACLE, PowerTiming.Action),
                modifiers: [HORN_USE]
            })
        )
        use.apply(s)
        const session = await openSessionOn(tableOf(s))
        const line = describeAction(use.dehydrate(), session.historyNames, 'rhys')
        expect(line).toContain('used Oracle, placing 2 secrets on it (Cracked Horn)')
    })
})

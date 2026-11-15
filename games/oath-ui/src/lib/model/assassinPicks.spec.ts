import { afterEach, describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import {
    ActionType,
    CURRENT_OATH_REVISION,
    MachineState,
    PlayerStatus,
    PowerChoiceKind,
    type HydratedOathGameState,
    type LegalPowerUse
} from '@tabletop/oath'
import { openTurn, required, served, testPlayer, testState } from '@tabletop/oath/testing'
import {
    disposeSessions,
    openSessionOn,
    tableOf,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'
import { emptyPicks, type PowerChoicePicks } from './powerChoices.js'
import type { OathGameSession } from './session.svelte.js'

// Assassin: "Action: Discard a faceup adviser of a player whose pawn is at your site." Its card is
// picked after its player: once the player is picked, the panel lists only that player's advisers.

afterEach(() => {
    disposeSessions()
})

const ASSASSIN = 'denizen.discord.assassin'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const SCOUTS = 'denizen.order.scouts'
const ELDERS = 'denizen.nomad.elders'
const FAITHFUL_FRIEND = 'denizen.nomad.faithful-friend'

type Row = { cardId: string; faceUp: boolean }
const up = (cardId: string): Row => ({ cardId, faceUp: true })

/** Dana, the Chancellor, at c1 with Assassin; Rhys at c1, and Ann too when `ann` is given. */
function table(rhys: Row[], ann?: Row[]): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                favor: 4,
                secrets: 2,
                advisers: [up(ASSASSIN)]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: 'c1', advisers: rhys }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                siteId: ann ? 'c1' : 'c2',
                advisers: ann ?? []
            })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'dana',
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } }
        }
    )
    openTurn(s, 'dana')
    return s
}

async function usingPowers(played: PlayedTable): Promise<OathGameSession> {
    const session = await openSessionOn(played)
    session.chooseAction(ActionType.UseActionPower)
    return session
}

function assassin(session: OathGameSession): LegalPowerUse {
    return required(
        session.actionPowers.powers.find((p) => p.cardId === ASSASSIN),
        'Assassin is listed'
    )
}

function playersListed(session: OathGameSession): string[] {
    return assassin(session).choices[0].options.flatMap((option) =>
        option.kind === PowerChoiceKind.Player ? [option.playerId] : []
    )
}

function cardsListed(session: OathGameSession): string[] {
    return assassin(session).choices[1].options.flatMap((option) =>
        option.kind === PowerChoiceKind.Card ? [option.cardId] : []
    )
}

/** The picks with `option` set at `spec` to the listed option naming `id`. */
function tapped(session: OathGameSession, spec: number, id: string): PowerChoicePicks {
    const power = assassin(session)
    const index = power.choices[spec].options.findIndex(
        (option) =>
            (option.kind === PowerChoiceKind.Player && option.playerId === id) ||
            (option.kind === PowerChoiceKind.Card && option.cardId === id)
    )
    expect(index).toBeGreaterThanOrEqual(0)
    const picks = session.actionPowers.picksOf(power)
    return { ...picks, option: { ...picks.option, [spec]: index } }
}

function tap(session: OathGameSession, spec: number, id: string): void {
    session.actionPowers.setPicks(assassin(session), tapped(session, spec, id))
}

function cardPicked(session: OathGameSession): string | undefined {
    const sent = session.actionPowers.choicesFor(assassin(session))
    return sent.flatMap((choice) =>
        choice.kind === PowerChoiceKind.Card ? [choice.cardId] : []
    )[0]
}

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
const views = (s: HydratedOathGameState): [string, PlayedTable][] => [
    ['the table', tableOf(s)],
    ["Dana's own view", { state: served(s, dana), actions: [] }]
]

describe("Assassin's card list follows the player picked", () => {
    for (const [name, played] of views(table([up(WOLVES)], [up(SCOUTS)]))) {
        it(`on ${name}: two players at the site, each with one faceup adviser: once one is picked, only their adviser`, async () => {
            const session = await usingPowers(played)
            expect(playersListed(session)).toEqual(['rhys', 'ann'])
            tap(session, 0, 'rhys')
            expect(cardsListed(session)).toEqual([WOLVES])
            expect(session.actionPowers.picksComplete(assassin(session))).toBe(true)
            expect(cardPicked(session)).toBe(WOLVES)
            expect(session.actionPowers.reasonCannotUse(assassin(session))).toBeUndefined()
            tap(session, 0, 'ann')
            expect(cardsListed(session)).toEqual([SCOUTS])
            expect(cardPicked(session)).toBe(SCOUTS)
            expect(session.actionPowers.reasonCannotUse(assassin(session))).toBeUndefined()
        })
    }

    it('a card tapped before its player is kept only while the player picked holds it; Undo takes back one tap', async () => {
        const session = await usingPowers(
            tableOf(table([up(WOLVES), up(TENTS)], [up(SCOUTS), up(ELDERS)]))
        )
        expect(cardsListed(session)).toEqual([WOLVES, TENTS, SCOUTS, ELDERS])
        tap(session, 1, SCOUTS)
        tap(session, 0, 'ann')
        expect(cardsListed(session)).toEqual([SCOUTS, ELDERS])
        expect(cardPicked(session)).toBe(SCOUTS)
        tap(session, 0, 'rhys')
        expect(cardsListed(session)).toEqual([WOLVES, TENTS])
        // Scouts is not Rhys's: no card of Rhys's is picked in its place.
        expect(cardPicked(session)).toBeUndefined()
        expect(session.actionPowers.picksComplete(assassin(session))).toBe(false)
        expect(session.actionPowers.back()).toBe(true)
        expect(cardsListed(session)).toEqual([SCOUTS, ELDERS])
        expect(cardPicked(session)).toBe(SCOUTS)
    })

    it('a player whose only faceup adviser is locked is not listed', async () => {
        const session = await usingPowers(tableOf(table([up(WOLVES)], [up(FAITHFUL_FRIEND)])))
        expect(playersListed(session)).toEqual(['rhys'])
        expect(cardsListed(session)).toEqual([WOLVES])
        expect(cardPicked(session)).toBe(WOLVES)
    })

    it('one player at the site: as before, their player picked and their advisers listed', async () => {
        const session = await usingPowers(tableOf(table([up(WOLVES), up(SCOUTS)])))
        expect(playersListed(session)).toEqual(['rhys'])
        expect(cardsListed(session)).toEqual([WOLVES, SCOUTS])
        expect(cardPicked(session)).toBeUndefined()
        tap(session, 1, SCOUTS)
        expect(cardPicked(session)).toBe(SCOUTS)
        expect(session.actionPowers.reasonCannotUse(assassin(session))).toBeUndefined()
    })

    it('before a player is picked, the panel lists the advisers of every player offered', async () => {
        const session = await usingPowers(tableOf(table([up(WOLVES)], [up(SCOUTS)])))
        expect(cardsListed(session)).toEqual([WOLVES, SCOUTS])
        expect(session.actionPowers.picksOf(assassin(session))).toEqual(emptyPicks())
    })
})

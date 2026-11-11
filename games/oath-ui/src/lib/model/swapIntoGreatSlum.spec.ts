import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, Color, type GameAction, type Visibility } from '@tabletop/common'
import {
    ActionType,
    HydratedPlayFacedownAdviser,
    HydratedSearchResolve,
    HydratedUseActionPower,
    PowerTiming,
    SearchResolve,
    UseActionPower,
    powerIndexOf,
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerChoiceKind,
    SearchPlay,
    type HydratedOathGameState,
    type LegalChoice,
    type LegalPowerUse,
    type PowerChoice
} from '@tabletop/oath'
import {
    buildAction,
    openTurn,
    required,
    served,
    testPlayer,
    testState,
    withChancellor
} from '@tabletop/oath/testing'
import {
    disposeSessions,
    openSessionOn,
    tableOf,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'
import { emptyPicks, type PowerChoicePicks } from './powerChoices.js'
import { describeAction, type HistoryNames } from './actionDescription.js'
import type { OathGameSession } from './session.svelte.js'
import { whenPlayedChoices } from './whenPlayed.js'

// The Great Slum: "When playing or moving a card to this site, you may discard a card here first." A swap moves
// each card to the other's place, so the Horned Mask's and Great Herd's swaps into the Great Slum offer a card there
// to discard first, with the words Homesteaders' row uses. The card swapped is never offered; Great Herd's list
// follows the card it swaps with.

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const MASK = 'relic.horned-mask'
const HERD = 'denizen.nomad.great-herd'
const ORACLE = 'denizen.nomad.oracle'
const HOMESTEADERS = 'denizen.hearth.homesteaders'
const LONGBOWS = 'denizen.order.longbows'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const SONGS = 'denizen.hearth.tavern-songs'
const SCOUTS = 'denizen.order.scouts'
const WILD_CRY = 'denizen.beast.wild-cry'
const TUTOR = 'denizen.arcane.tutor'
const SLUM = 'site.great-slums'
const FIRST = 'a denizen at the Great Slum to discard first'

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
const views = (s: HydratedOathGameState): [string, PlayedTable][] => [
    ['the table', tableOf(s)],
    ["Dana's own view", { state: served(s, dana), actions: [] }]
]

const names: HistoryNames = {
    player: (playerId) => ({ dana: 'Dana', rhys: 'Rhys' })[playerId] ?? playerId,
    site: (slotId) => slotId,
    seats: ['dana', 'rhys']
}

/** The History row of an action the engine applied (its fields and its metadata), as Dana reads it. */
function historyOf(fields: { type: ActionType } & Record<string, unknown>): string {
    const action: GameAction = { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
    return describeAction(action, names, 'dana')
}

const card = (cardId: string): PowerChoice => ({ kind: PowerChoiceKind.Card, cardId })

const cardsIn = (choices: readonly PowerChoice[]): string[] =>
    choices.flatMap((choice) => (choice.kind === PowerChoiceKind.Card ? [choice.cardId] : []))

const cardIds = (legal: LegalChoice | undefined): string[] => cardsIn(legal?.options ?? [])

describe('the Horned Mask at the Great Slum, in Use a power', () => {
    /** Dana (Exile) at c1 with the Horned Mask, Homesteaders and Longbows; c1 holds the Wolves, Tents and Tavern Songs. */
    function table(
        revision: OathRevision = OathRevision.EngineFixes27,
        c1 = SLUM
    ): HydratedOathGameState {
        const s = testState(
            withChancellor([
                testPlayer({
                    playerId: 'dana',
                    color: Color.Red,
                    siteId: 'c1',
                    favor: 3,
                    secrets: 2,
                    status: PlayerStatus.Exile,
                    relicIds: [MASK],
                    advisers: [
                        { cardId: HOMESTEADERS, faceUp: true },
                        { cardId: LONGBOWS, faceUp: true }
                    ]
                }),
                testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2 })
            ]),
            {
                oathRevision: revision,
                machineState: MachineState.ActPhase,
                denizensBySite: { c1: [WOLVES, TENTS, SONGS], c2: [], p1: [], h1: [] },
                siteCards: { c1, c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
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

    const mask = (session: OathGameSession): LegalPowerUse =>
        required(
            session.actionPowers.powers.find((p) => p.cardId === MASK),
            'the Horned Mask is listed'
        )

    function tap(session: OathGameSession, spec: number, cardId: string): void {
        const power = mask(session)
        const index = cardIds(power.choices[spec]).indexOf(cardId)
        expect(index).toBeGreaterThanOrEqual(0)
        const picks: PowerChoicePicks = session.actionPowers.picksOf(power)
        session.actionPowers.setPicks(power, {
            ...picks,
            option: { ...picks.option, [spec]: index }
        })
    }

    const sent = (session: OathGameSession) =>
        cardsIn(session.actionPowers.choicesFor(mask(session)))

    for (const [name, played] of views(table())) {
        it(`on ${name}: its row ends with Homesteaders' pick, which leaves out the card swapped`, async () => {
            const session = await usingPowers(played)
            const choices = mask(session).choices
            expect(choices.map((legal) => legal.spec.what)).toEqual([
                'one of your faceup advisers',
                'a card at your site',
                FIRST
            ])
            expect(choices[2].spec.min).toBe(0)
            tap(session, 0, LONGBOWS)
            tap(session, 1, TENTS)
            expect(cardIds(mask(session).choices[2])).toEqual([WOLVES, SONGS])
            expect(session.actionPowers.reasonCannotUse(mask(session))).toBeUndefined()
            tap(session, 2, WOLVES)
            expect(sent(session)).toEqual([LONGBOWS, TENTS, WOLVES])
            expect(session.actionPowers.reasonCannotUse(mask(session))).toBeUndefined()
        })
    }

    it('a card picked to go first that is then picked to swap is taken back from the first pick', async () => {
        const session = await usingPowers(tableOf(table()))
        tap(session, 0, LONGBOWS)
        tap(session, 1, TENTS)
        tap(session, 2, WOLVES)
        tap(session, 1, WOLVES)
        expect(cardIds(mask(session).choices[2])).toEqual([TENTS, SONGS])
        expect(sent(session)).toEqual([LONGBOWS, WOLVES])
    })

    it('away from the Great Slum the row offers nothing', async () => {
        const session = await usingPowers(tableOf(table(OathRevision.EngineFixes27, 'site.plains')))
        tap(session, 0, LONGBOWS)
        tap(session, 1, TENTS)
        expect(cardIds(mask(session).choices[2])).toEqual([])
    })

    it('History: "discarded Wolves first; swapped Longbows with Tents", and without a card first as before', () => {
        const row = (choices: string[]) => {
            const s = table()
            const fields = {
                type: ActionType.UseActionPower as const,
                playerId: 'dana',
                cardId: MASK,
                powerIndex: powerIndexOf(MASK, PowerTiming.Action),
                choices: choices.map(card)
            }
            const used = new HydratedUseActionPower(buildAction(UseActionPower, fields))
            used.apply(s)
            return historyOf({ ...fields, metadata: used.metadata })
        }
        expect(row([LONGBOWS, TENTS, WOLVES])).toBe(
            'used Horned Mask, placing a secret on it: discarded Wolves first; swapped Longbows with Tents; ' +
                'Wolves went to the Provinces discard pile'
        )
        expect(row([LONGBOWS, TENTS])).toBe(
            'used Horned Mask, placing a secret on it: swapped Longbows with Tents'
        )
    })

    it('before revision 32 the row is not there', async () => {
        const session = await usingPowers(tableOf(table(OathRevision.EngineFixes26)))
        expect(mask(session).choices.map((legal) => legal.spec.what)).toEqual([
            'one of your faceup advisers',
            'a card at your site'
        ])
    })
})

describe("Great Herd's When Played swap into the Great Slum, in the Search panel", () => {
    /** Dana searching at c1 with Great Herd and the Tutor drawn; the Oracle, a Nomad card, at h1. */
    function table(
        denizensBySite: Record<string, string[]>,
        c1: string,
        c2: string,
        revision: OathRevision = OathRevision.EngineFixes27
    ): HydratedOathGameState {
        const s = testState(
            withChancellor([
                testPlayer({
                    playerId: 'dana',
                    color: Color.Red,
                    siteId: 'c1',
                    favor: 2,
                    handIds: [HERD, TUTOR]
                })
            ]),
            {
                oathRevision: revision,
                machineState: MachineState.Searching,
                denizensBySite: { c1: [], c2: [], p1: [], h1: [ORACLE], ...denizensBySite },
                siteCards: { c1, c2, p1: 'site.marshes', h1: 'site.mountain' }
            }
        )
        openTurn(s, 'dana')
        return s
    }

    async function playingHerd(played: PlayedTable) {
        const session = await openSessionOn(played)
        const resolved = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
        const draft = session.search
        draft.keep(HERD)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.needsWhenPlayed).toBe(true)
        return { session, draft, resolved }
    }

    type Draft = Awaited<ReturnType<typeof playingHerd>>['draft']

    function tap(draft: Draft, spec: number, cardId: string): void {
        const index = cardIds(draft.whenPlayed[spec]).indexOf(cardId)
        expect(index).toBeGreaterThanOrEqual(0)
        draft.setPicks({ ...draft.picks, option: { ...draft.picks.option, [spec]: index } })
    }

    const atTheSlum = () => table({ c1: [WOLVES, SCOUTS] }, SLUM, 'site.river')

    for (const [name, played] of views(atTheSlum())) {
        it(`on ${name}: played to the Great Slum, the row offers its cards once the card to swap with is picked`, async () => {
            const { session, draft, resolved } = await playingHerd(played)
            expect(draft.whenPlayed.map((legal) => legal.spec.what)).toEqual([
                'a Nomad card at a site to swap with',
                FIRST
            ])
            expect(cardIds(draft.whenPlayed[1])).toEqual([])
            tap(draft, 0, ORACLE)
            expect(cardIds(draft.whenPlayed[1])).toEqual([WOLVES, SCOUTS])
            tap(draft, 1, WOLVES)
            expect(draft.whenPlayedReason).toBeUndefined()
            await draft.confirmWhenPlayed()
            expect(resolved).toHaveBeenCalledWith(
                expect.objectContaining({
                    keptCardId: HERD,
                    play: SearchPlay.Site,
                    choices: [
                        { kind: PowerChoiceKind.Card, cardId: ORACLE },
                        { kind: PowerChoiceKind.Card, cardId: WOLVES }
                    ]
                })
            )
            const [choice] = resolved.mock.calls[0]
            expect(
                HydratedSearchResolve.reasonCannotResolve(session.gameState, 'dana', choice)
            ).toBeUndefined()
        })
    }

    it('swapping with a card at the Great Slum: never that card, and a pick of it is taken back when it is picked to swap', async () => {
        const { draft } = await playingHerd(
            tableOf(table({ c2: [ORACLE, TENTS], h1: [] }, 'site.plains', SLUM))
        )
        tap(draft, 0, ORACLE)
        expect(cardIds(draft.whenPlayed[1])).toEqual([TENTS])
        tap(draft, 1, TENTS)
        tap(draft, 0, TENTS)
        expect(cardIds(draft.whenPlayed[1])).toEqual([ORACLE])
        expect(draft.picks.option).toEqual({ 0: cardIds(draft.whenPlayed[0]).indexOf(TENTS) })
    })

    it('when the swap reaches no Great Slum the row offers nothing', async () => {
        const { draft } = await playingHerd(
            tableOf(table({ c1: [WOLVES] }, 'site.plains', 'site.river'))
        )
        tap(draft, 0, ORACLE)
        expect(cardIds(draft.whenPlayed[1])).toEqual([])
    })

    /** Dana on turn at c1, the Great Slum holding Wild Cry and the Wolves, with Great Herd a facedown adviser. */
    function flipTable(): HydratedOathGameState {
        const s = testState(
            withChancellor([
                testPlayer({
                    playerId: 'dana',
                    color: Color.Red,
                    siteId: 'c1',
                    favor: 2,
                    advisers: [{ cardId: HERD, faceUp: false }]
                })
            ]),
            {
                oathRevision: OathRevision.EngineFixes27,
                machineState: MachineState.ActPhase,
                denizensBySite: { c1: [WILD_CRY, WOLVES], c2: [], p1: [], h1: [ORACLE] },
                siteCards: { c1: SLUM, c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
            }
        )
        openTurn(s, 'dana')
        return s
    }

    // The panel reads the play's When Played choices on the map changes of the play with the cards it declares.
    for (const [name, played] of views(flipTable())) {
        it(`on ${name}: turned faceup to the Great Slum with Wild Cry declared, the row leaves Wild Cry out`, async () => {
            const state = (await openSessionOn(played)).gameState
            const modifiers = [
                { cardId: WILD_CRY, powerIndex: powerIndexOf(WILD_CRY, PowerTiming.Modifier) }
            ]
            const changes = HydratedPlayFacedownAdviser.playMapChanges(state, 'dana', {
                cardId: HERD,
                play: SearchPlay.Site,
                modifiers
            })
            const swapWith = whenPlayedChoices(state, 'dana', HERD, SearchPlay.Site, true, changes)
            const picks: PowerChoicePicks = {
                ...emptyPicks(),
                option: { 0: cardIds(swapWith[0]).indexOf(ORACLE) }
            }
            const offered = whenPlayedChoices(
                state,
                'dana',
                HERD,
                SearchPlay.Site,
                true,
                changes,
                picks
            )
            expect(offered[1]?.spec.what).toBe(FIRST)
            expect(cardIds(offered[1])).toEqual([WOLVES])
            expect(
                HydratedPlayFacedownAdviser.reasonCannotPlay(state, 'dana', {
                    cardId: HERD,
                    play: SearchPlay.Site,
                    modifiers,
                    choices: [card(ORACLE), card(WILD_CRY)]
                })
            ).toBeDefined()
        })
    }

    it('History names the card discarded first before the swap', () => {
        const s = atTheSlum()
        const fields = {
            type: ActionType.SearchResolve as const,
            playerId: 'dana',
            keptCardId: HERD,
            discardOrder: [TUTOR],
            play: SearchPlay.Site,
            choices: [ORACLE, WOLVES].map(card)
        }
        const resolved = new HydratedSearchResolve(buildAction(SearchResolve, fields))
        resolved.apply(s)
        expect(historyOf({ ...fields, metadata: resolved.metadata })).toContain(
            'discarded Wolves first; swapped Great Herd with Oracle'
        )
    })

    it('before revision 32 only the swap is asked', async () => {
        const { draft } = await playingHerd(
            tableOf(table({ c1: [WOLVES, SCOUTS] }, SLUM, 'site.river', OathRevision.EngineFixes26))
        )
        expect(draft.whenPlayed.map((legal) => legal.spec.what)).toEqual([
            'a Nomad card at a site to swap with'
        ])
        expect(draft.picks).toEqual(emptyPicks())
    })
})

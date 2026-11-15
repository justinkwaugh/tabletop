import { describe, expect, it, vi } from 'vitest'
import { Color, assert, type Visibility } from '@tabletop/common'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { SearchPlay } from './searchResolve.js'
import { Banner } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { INN } from '../testing/cards.js'
import { CONSPIRACY_ID } from '../data/visions.js'
import { OathRevision } from '../util/revision.js'
import { OathVisibility } from '../definition/runtime.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { served, servedJson } from '../testing/projection.js'
import '../powers/index.js'

const FORCED_LABOR = 'denizen.order.forced-labor'
const WOLVES = 'denizen.beast.wolves'
const STORYTELLER = 'denizen.hearth.storyteller'
const RANGERS = 'denizen.beast.rangers'

/** `me` is on turn at c1, which `foe` rules with Forced Labor there; `facedown` is `me`'s facedown adviser. */
function table(
    facedown: string,
    oathRevision: number,
    me: Record<string, unknown> = {},
    foe: Record<string, unknown> = {}
) {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                favor: 2,
                secrets: 2,
                supply: 3,
                advisers: [{ cardId: facedown, faceUp: false }],
                ...me
            }),
            testPlayer({
                playerId: 'foe',
                color: Color.Blue,
                siteId: 'c1',
                favor: 2,
                secrets: 2,
                ...foe
            })
        ]),
        {
            oathRevision,
            denizensBySite: { c1: [FORCED_LABOR], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { foe: 2 } },
            banners: {
                [Banner.DarkestSecret]: { value: 1, holderPlayerId: 'foe' },
                [Banner.PeoplesFavor]: { value: 1 }
            }
        }
    )
    openTurn(s, 'me')
    return s
}

const atRevision = OathRevision.PlanCostsAndSearchPlays

function play(cardId: string, to: SearchPlay, extra: Record<string, unknown> = {}) {
    return new HydratedPlayFacedownAdviser(
        buildAction(PlayFacedownAdviser, { playerId: 'me', cardId, play: to, ...extra })
    )
}

describe('R-6.1 — Forced Labor tolls a facedown adviser’s play, as its Q&A rules', () => {
    it('a site play is refused until the toll is listed, then gives a favor to the ruler', () => {
        const s = table(INN, atRevision)
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', {
                cardId: INN,
                play: SearchPlay.Site
            })
        ).toBe(
            `${FORCED_LABOR}: you cannot play or discard a facedown adviser here unless you give a favor to its ruler`
        )
        expect(HydratedPlayFacedownAdviser.tolls(s, 'me')).toEqual([FORCED_LABOR])
        const a = play(INN, SearchPlay.Site, { tolls: [FORCED_LABOR] })
        a.apply(s)

        expect(s.getPlayerState('me').favor).toBe(2)
        expect(s.getPlayerState('foe').favor).toBe(3)
        expect(a.metadata?.favorGained).toBe(1)
        expect(a.metadata?.tollsPaid).toEqual([`${FORCED_LABOR}: gave a favor to foe`])
    })

    it('a discard pays the toll too: R-6.1’s play includes "or discard it"', () => {
        const s = table(WOLVES, atRevision)
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', {
                cardId: WOLVES,
                play: SearchPlay.Discard
            })
        ).toMatch(/unless you give a favor/)
        const a = play(WOLVES, SearchPlay.Discard, { tolls: [FORCED_LABOR] })
        a.apply(s)

        expect(s.getPlayerState('me').favor).toBe(1)
        expect(s.getPlayerState('foe').favor).toBe(3)
        expect(a.metadata?.tollsPaid).toEqual([`${FORCED_LABOR}: gave a favor to foe`])
    })

    it('with no favor to give, no play is offered and a listed toll is refused', () => {
        const s = table(WOLVES, atRevision, { favor: 0 })
        expect(HydratedPlayFacedownAdviser.legalCards(s, 'me')).toEqual([])
        expect(HydratedPlayFacedownAdviser.canDoPlayFacedownAdviser(s, 'me')).toBe(false)
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', {
                cardId: WOLVES,
                play: SearchPlay.Discard,
                tolls: [FORCED_LABOR]
            })
        ).toBe('the tolls take 1 favor and you have 0')
        expect(() => play(WOLVES, SearchPlay.Discard, { tolls: [FORCED_LABOR] }).apply(s)).toThrow(
            /the tolls take 1 favor/
        )
    })

    it('the ruler and a player away from the ruled site pay nothing', () => {
        const s = table(WOLVES, atRevision)
        expect(HydratedPlayFacedownAdviser.tolls(s, 'foe')).toEqual([])
        s.getPlayerState('me').siteId = 'p1'
        expect(HydratedPlayFacedownAdviser.tolls(s, 'me')).toEqual([])
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', {
                cardId: WOLVES,
                play: SearchPlay.Discard
            })
        ).toBeUndefined()
    })

    it('the toll is paid with the Conspiracy’s burned secret, each from its own holding', () => {
        const conspiring = (secrets: number) =>
            table(
                CONSPIRACY_ID,
                atRevision,
                {
                    favor: 1,
                    secrets,
                    advisers: [
                        { cardId: CONSPIRACY_ID, faceUp: false },
                        { cardId: STORYTELLER, faceUp: true },
                        { cardId: RANGERS, faceUp: true }
                    ]
                },
                {
                    advisers: [
                        { cardId: INN, faceUp: true },
                        { cardId: WOLVES, faceUp: true }
                    ]
                }
            )
        const conspiracy = {
            targetPlayerId: 'foe',
            take: { kind: 'banner' as const, banner: Banner.DarkestSecret }
        }

        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(conspiring(0), 'me', {
                cardId: CONSPIRACY_ID,
                play: SearchPlay.Conspiracy,
                conspiracy,
                tolls: [FORCED_LABOR]
            })
        ).toBeDefined()
        const s = conspiring(1)
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', {
                cardId: CONSPIRACY_ID,
                play: SearchPlay.Conspiracy,
                conspiracy,
                tolls: [FORCED_LABOR]
            })
        ).toBeUndefined()
        play(CONSPIRACY_ID, SearchPlay.Conspiracy, { conspiracy, tolls: [FORCED_LABOR] }).apply(s)
        expect(s.getPlayerState('me').favor).toBe(0)
        expect(s.getPlayerState('me').secrets).toBe(0)
        expect(s.banners[Banner.DarkestSecret]?.holderPlayerId).toBe('me')
    })

    it('R-X.4 — in a game created before the revision, no toll is asked and one listed is refused', () => {
        const s = table(WOLVES, OathRevision.CostsAndFacedownModifiers, { favor: 0 })
        expect(HydratedPlayFacedownAdviser.tolls(s, 'me')).toEqual([])
        expect(HydratedPlayFacedownAdviser.legalCards(s, 'me')).toEqual([WOLVES])
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', {
                cardId: WOLVES,
                play: SearchPlay.Discard
            })
        ).toBeUndefined()
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', {
                cardId: WOLVES,
                play: SearchPlay.Discard,
                tolls: [FORCED_LABOR]
            })
        ).toBe(`${FORCED_LABOR} demands no toll here`)
    })

    it('R-9.4 — another seat sees the toll on a discard, never the card discarded', () => {
        const s = table(WOLVES, atRevision)
        const a = play(WOLVES, SearchPlay.Discard, { tolls: [FORCED_LABOR] })
        a.apply(s)
        for (const viewer of [
            { kind: 'player' as const, playerId: 'foe' },
            { kind: 'spectator' as const }
        ]) {
            const seen = JSON.stringify(OathVisibility.actions.project(a.dehydrate(), viewer))
            expect(seen).toContain(`${FORCED_LABOR}: gave a favor to foe`)
            expect(seen).not.toContain(WOLVES)
        }
    })

    it('R-X.4 — each revision’s facedown discard at Forced Labor replays unchanged', () => {
        for (const [revision, favor] of [
            [OathRevision.CostsAndFacedownModifiers, 2],
            [atRevision, 1]
        ]) {
            const before = table(WOLVES, revision).dehydrate()
            const game = testGame(['me', 'foe', 'chancellor'])
            const tolls = revision === atRevision ? { tolls: [FORCED_LABOR] } : {}
            const recorded = engine.runNext(
                buildAction(PlayFacedownAdviser, {
                    playerId: 'me',
                    cardId: WOLVES,
                    play: SearchPlay.Discard,
                    ...tolls
                }),
                structuredClone(before),
                game
            )
            expect(recorded.updatedState.players.find((p) => p.playerId === 'me')?.favor).toBe(
                favor
            )

            let replayed = structuredClone(before)
            for (const action of recorded.processedActions)
                replayed = engine.run(
                    structuredClone(action),
                    replayed,
                    game,
                    RunMode.Single
                ).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        }
    })
})

describe('R-6.1, R-7.1.4 — the tolls that alone bar every facedown play, which the table names', () => {
    const CONQUEST = 'vision.conquest'
    const barring = (s: HydratedOathGameState, playerId = 'me') =>
        HydratedPlayFacedownAdviser.tollsAloneBarPlay(s, playerId).map((toll) => toll.cardId)

    it('with no favor to give, Forced Labor alone bars the play, and its toll goes to the ruler', () => {
        const s = table(WOLVES, atRevision, { favor: 0 })
        expect(HydratedPlayFacedownAdviser.legalCards(s, 'me')).toEqual([])
        expect(HydratedPlayFacedownAdviser.tollsAloneBarPlay(s, 'me')).toEqual([
            { cardId: FORCED_LABOR, payeeId: 'foe' }
        ])
    })

    it('with 1 favor or 2 the card is offered, so no toll bars it', () => {
        for (const favor of [1, 2]) {
            const s = table(WOLVES, atRevision, { favor })
            expect(HydratedPlayFacedownAdviser.legalCards(s, 'me'), `${favor}`).toEqual([WOLVES])
            expect(barring(s), `${favor}`).toEqual([])
        }
    })

    it('a facedown Vision beside a facedown denizen: the one toll bars both', () => {
        const s = table(WOLVES, atRevision, {
            favor: 0,
            advisers: [
                { cardId: WOLVES, faceUp: false },
                { cardId: CONQUEST, faceUp: false }
            ]
        })
        expect(HydratedPlayFacedownAdviser.legalCards(s, 'me')).toEqual([])
        expect(barring(s)).toEqual([FORCED_LABOR])
    })

    it('the ruler, a player away from the ruled site, and a player with no facedown adviser are barred by nothing', () => {
        const s = table(
            WOLVES,
            atRevision,
            { favor: 0 },
            { favor: 0, advisers: [{ cardId: INN, faceUp: false }] }
        )
        expect(barring(s, 'foe')).toEqual([])
        const faceup = table(WOLVES, atRevision, {
            favor: 0,
            advisers: [{ cardId: WOLVES, faceUp: true }]
        })
        expect(barring(faceup)).toEqual([])
        s.getPlayerState('me').siteId = 'p1'
        expect(barring(s)).toEqual([])
    })

    it('R-X.4 — in a game created before the revision no toll is asked, so none bars the play', () => {
        const s = table(WOLVES, OathRevision.CostsAndFacedownModifiers, { favor: 0 })
        expect(HydratedPlayFacedownAdviser.legalCards(s, 'me')).toEqual([WOLVES])
        expect(barring(s)).toEqual([])
    })

    it("R-9.4 — each player's own view reads the same as the server, never copying the state", () => {
        const views = ['me', 'foe'].map((playerId): Visibility.Perspective => ({
            kind: 'player',
            playerId
        }))
        for (const favor of [0, 1]) {
            const s = table(
                WOLVES,
                atRevision,
                {
                    favor,
                    advisers: [
                        { cardId: WOLVES, faceUp: false },
                        { cardId: CONQUEST, faceUp: false }
                    ]
                },
                { advisers: [{ cardId: INN, faceUp: false }] }
            )
            const before = views.map((view) => servedJson(s, view))
            for (const view of views) {
                assert(view.kind === 'player')
                const own = OathVisibility.state.guardForExecution(
                    new HydratedOathGameState(served(s, view)),
                    view
                )
                const copied = vi.spyOn(own, 'dehydrate')
                const seen = HydratedPlayFacedownAdviser.tollsAloneBarPlay(own, view.playerId)
                expect(seen, `${favor}, ${view.playerId}`).toEqual(
                    HydratedPlayFacedownAdviser.tollsAloneBarPlay(s, view.playerId)
                )
                expect(seen.map((toll) => toll.cardId)).toEqual(
                    favor === 0 && view.playerId === 'me' ? [FORCED_LABOR] : []
                )
                expect(copied, `${favor}, ${view.playerId}`).not.toHaveBeenCalled()
            }
            expect(views.map((view) => servedJson(s, view))).toEqual(before)
        }
    })
})

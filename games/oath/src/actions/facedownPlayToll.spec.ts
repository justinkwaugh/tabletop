import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
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
import '../powers/index.js'

const FORCED_LABOR = 'denizen.order.forced-labor'
const WOLVES = 'denizen.beast.wolves'
const STORYTELLER = 'denizen.hearth.storyteller'
const RANGERS = 'denizen.beast.rangers'

/** `me` is on turn at c1, which `foe` rules with Forced Labor there; `facedown` is `me`'s facedown adviser. */
function table(facedown: string, oathRevision: number, me: Record<string, unknown> = {}, foe: Record<string, unknown> = {}) {
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
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c1', favor: 2, secrets: 2, ...foe })
        ]),
        {
            oathRevision,
            denizensBySite: { c1: [FORCED_LABOR], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { foe: 2 } },
            banners: { [Banner.DarkestSecret]: { value: 1, holderPlayerId: 'foe' }, [Banner.PeoplesFavor]: { value: 1 } }
        }
    )
    openTurn(s, 'me')
    return s
}

const atRevision = OathRevision.PlanCostsAndSearchPlays

function play(cardId: string, to: SearchPlay, extra: Record<string, unknown> = {}) {
    return new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, { playerId: 'me', cardId, play: to, ...extra }))
}

describe('R-6.1 — Forced Labor tolls a facedown adviser’s play, as its Q&A rules', () => {
    it('a site play is refused until the toll is listed, then gives a favor to the ruler', () => {
        const s = table(INN, atRevision)
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: INN, play: SearchPlay.Site })).toBe(
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
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: WOLVES, play: SearchPlay.Discard })).toMatch(/unless you give a favor/)
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
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: WOLVES, play: SearchPlay.Discard, tolls: [FORCED_LABOR] })).toBe(
            'the tolls take 1 favor and you have 0'
        )
        expect(() => play(WOLVES, SearchPlay.Discard, { tolls: [FORCED_LABOR] }).apply(s)).toThrow(/the tolls take 1 favor/)
    })

    it('the ruler and a player away from the ruled site pay nothing', () => {
        const s = table(WOLVES, atRevision)
        expect(HydratedPlayFacedownAdviser.tolls(s, 'foe')).toEqual([])
        s.getPlayerState('me').siteId = 'p1'
        expect(HydratedPlayFacedownAdviser.tolls(s, 'me')).toEqual([])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: WOLVES, play: SearchPlay.Discard })).toBeUndefined()
    })

    it('the toll is paid with the Conspiracy’s burned secret, each from its own holding', () => {
        const conspiring = (secrets: number) =>
            table(CONSPIRACY_ID, atRevision, {
                favor: 1,
                secrets,
                advisers: [{ cardId: CONSPIRACY_ID, faceUp: false }, { cardId: STORYTELLER, faceUp: true }, { cardId: RANGERS, faceUp: true }]
            }, { advisers: [{ cardId: INN, faceUp: true }, { cardId: WOLVES, faceUp: true }] })
        const conspiracy = { targetPlayerId: 'foe', take: { kind: 'banner' as const, banner: Banner.DarkestSecret } }

        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(conspiring(0), 'me', { cardId: CONSPIRACY_ID, play: SearchPlay.Conspiracy, conspiracy, tolls: [FORCED_LABOR] })).toBeDefined()
        const s = conspiring(1)
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: CONSPIRACY_ID, play: SearchPlay.Conspiracy, conspiracy, tolls: [FORCED_LABOR] })).toBeUndefined()
        play(CONSPIRACY_ID, SearchPlay.Conspiracy, { conspiracy, tolls: [FORCED_LABOR] }).apply(s)
        expect(s.getPlayerState('me').favor).toBe(0)
        expect(s.getPlayerState('me').secrets).toBe(0)
        expect(s.banners[Banner.DarkestSecret]?.holderPlayerId).toBe('me')
    })

    it('R-X.4 — in a game created before the revision, no toll is asked and one listed is refused', () => {
        const s = table(WOLVES, OathRevision.CostsAndFacedownModifiers, { favor: 0 })
        expect(HydratedPlayFacedownAdviser.tolls(s, 'me')).toEqual([])
        expect(HydratedPlayFacedownAdviser.legalCards(s, 'me')).toEqual([WOLVES])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: WOLVES, play: SearchPlay.Discard })).toBeUndefined()
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: WOLVES, play: SearchPlay.Discard, tolls: [FORCED_LABOR] })).toBe(
            `${FORCED_LABOR} demands no toll here`
        )
    })

    it('R-9.4 — another seat sees the toll on a discard, never the card discarded', () => {
        const s = table(WOLVES, atRevision)
        const a = play(WOLVES, SearchPlay.Discard, { tolls: [FORCED_LABOR] })
        a.apply(s)
        for (const viewer of [{ kind: 'player' as const, playerId: 'foe' }, { kind: 'spectator' as const }]) {
            const seen = JSON.stringify(OathVisibility.actions.project(a.dehydrate(), viewer))
            expect(seen).toContain(`${FORCED_LABOR}: gave a favor to foe`)
            expect(seen).not.toContain(WOLVES)
        }
    })

    it('R-X.4 — each revision’s facedown discard at Forced Labor replays unchanged', () => {
        for (const [revision, favor] of [[OathRevision.CostsAndFacedownModifiers, 2], [atRevision, 1]]) {
            const before = table(WOLVES, revision).dehydrate()
            const game = testGame(['me', 'foe', 'chancellor'])
            const tolls = revision === atRevision ? { tolls: [FORCED_LABOR] } : {}
            const recorded = engine.runNext(buildAction(PlayFacedownAdviser, { playerId: 'me', cardId: WOLVES, play: SearchPlay.Discard, ...tolls }), structuredClone(before), game)
            expect(recorded.updatedState.players.find((p) => p.playerId === 'me')?.favor).toBe(favor)

            let replayed = structuredClone(before)
            for (const action of recorded.processedActions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        }
    })
})

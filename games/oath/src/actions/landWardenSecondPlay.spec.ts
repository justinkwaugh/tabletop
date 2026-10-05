import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve, type SearchSecondPlay } from './searchResolve.js'
import { Suit } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { modifierUse } from '../testing/choices.js'
import { INN, FILLER } from '../testing/cards.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const BOOK = 'relic.book-of-records'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'

const atRevision = OathRevision.PlanCostsAndSearchPlays

/** `me` holds Book of Records and Land Warden; the world deck's top three are Wolves, Wayside Inn and a filler. */
function table(oathRevision: number) {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                relicIds: [BOOK],
                advisers: [{ cardId: LAND_WARDEN, faceUp: true }]
            }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { me: 1 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
        }
    )
    openTurn(s, 'me')
    s.requireVault().worldDeck = [WOLVES, INN, FILLER]
    return s
}

const search = buildAction(Search, { playerId: 'me', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(LAND_WARDEN)] })

/** …and has searched the world deck with Land Warden declared, drawing those three. */
function searched(oathRevision: number) {
    const s = table(oathRevision)
    new HydratedSearch(search).apply(s)
    return s
}

function resolve(first: SearchPlay, second: SearchSecondPlay, faceUp?: boolean) {
    return new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'me', keptCardId: WOLVES, discardOrder: [FILLER], play: first, faceUp, secondPlay: second }))
}

const innToSite: SearchSecondPlay = { cardId: INN, play: SearchPlay.Site }

describe('Land Warden — R-7.4: the second card’s play takes the Search’s carried modifiers', () => {
    it('Book of Records: both cards played to the site gain a secret each and no favor', () => {
        const s = searched(atRevision)
        const banks = { beast: s.favorBank[Suit.Beast], hearth: s.favorBank[Suit.Hearth] }
        const before = s.getPlayerState('me')
        const favor = before.favor
        const secrets = before.secrets
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'me', { keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site, secondPlay: innToSite })).toBeUndefined()
        const a = resolve(SearchPlay.Site, innToSite)
        a.apply(s)

        expect(s.denizensBySite['c1']).toEqual([WOLVES, INN])
        expect(s.getPlayerState('me').secrets).toBe(secrets + 2)
        expect(s.getPlayerState('me').favor).toBe(favor)
        expect(s.favorBank[Suit.Beast]).toBe(banks.beast)
        expect(s.favorBank[Suit.Hearth]).toBe(banks.hearth)
        expect(a.metadata?.favorGained).toBe(0)
        expect(a.metadata?.secretsGained).toBe(2)
    })

    it('Book of Records: only the second card to the site, so one secret, from that card', () => {
        const s = searched(atRevision)
        const secrets = s.getPlayerState('me').secrets
        const hearth = s.favorBank[Suit.Hearth]
        const a = resolve(SearchPlay.Adviser, innToSite, false)
        a.apply(s)

        expect(s.getPlayerState('me').secrets).toBe(secrets + 1)
        expect(s.favorBank[Suit.Hearth]).toBe(hearth)
        expect(a.metadata?.secretsGained).toBe(1)
    })

    it('R-X.4 — in a game created before the revision, the second card takes no modifier and gains favor', () => {
        const s = searched(OathRevision.CostsAndFacedownModifiers)
        const favor = s.getPlayerState('me').favor
        const secrets = s.getPlayerState('me').secrets
        const hearth = s.favorBank[Suit.Hearth]
        const a = resolve(SearchPlay.Site, innToSite)
        a.apply(s)

        expect(s.getPlayerState('me').secrets).toBe(secrets + 1)
        expect(s.getPlayerState('me').favor).toBe(favor + 1)
        expect(s.favorBank[Suit.Hearth]).toBe(hearth - 1)
        expect(a.metadata?.favorGained).toBe(0)
        expect(a.metadata?.secretsGained).toBe(1)
    })

    it('R-X.4 — each revision’s two site plays under Book of Records replay unchanged', () => {
        for (const [revision, favor, secrets] of [[OathRevision.CostsAndFacedownModifiers, 3, 3], [atRevision, 2, 4]]) {
            const before = table(revision).dehydrate()
            const game = testGame(['me', 'foe', 'chancellor'])
            const drawn = engine.runNext(structuredClone(search), structuredClone(before), game)
            const recorded = engine.runNext(
                buildAction(SearchResolve, { playerId: 'me', keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site, secondPlay: innToSite }),
                drawn.updatedState,
                game
            )
            const me = recorded.updatedState.players.find((p) => p.playerId === 'me')
            expect(me?.favor).toBe(favor)
            expect(me?.secrets).toBe(secrets)

            let replayed = structuredClone(before)
            for (const action of [...drawn.processedActions, ...recorded.processedActions]) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        }
    })
})

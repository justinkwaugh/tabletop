import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayFacedownAdviser } from './playFacedownAdviser.js'
import { SearchPlay } from './searchResolve.js'
import { Banner } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { INN } from '../testing/cards.js'
import { expectFavorConserved } from '../testing/census.js'
import { CONSPIRACY_ID } from '../data/visions.js'
import { seizeBanner } from '../util/seize.js'
import { payCostOnCard } from '../util/powerCost.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const VOW_OF_RENEWAL = 'denizen.discord.vow-of-renewal'
const STORYTELLER = 'denizen.hearth.storyteller'
const RANGERS = 'denizen.beast.rangers'
const WOLVES = 'denizen.beast.wolves'
const CAPTAINS = 'denizen.order.captains'

const atRevision = OathRevision.EngineFixes2
const before = OathRevision.CardFixes1

/** `me` holds the Conspiracy facedown and can take the People's Favor (value 5) from `foe`; `keeper` holds Vow of Renewal. */
function table(oathRevision: number) {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                favor: 2,
                secrets: 2,
                advisers: [
                    { cardId: CONSPIRACY_ID, faceUp: false },
                    { cardId: STORYTELLER, faceUp: true },
                    { cardId: RANGERS, faceUp: true }
                ]
            }),
            testPlayer({
                playerId: 'foe',
                color: Color.Blue,
                siteId: 'c1',
                favor: 2,
                advisers: [
                    { cardId: INN, faceUp: true },
                    { cardId: WOLVES, faceUp: true }
                ]
            }),
            testPlayer({
                playerId: 'keeper',
                color: Color.Yellow,
                siteId: 'c2',
                favor: 2,
                advisers: [{ cardId: VOW_OF_RENEWAL, faceUp: true }]
            })
        ]),
        {
            oathRevision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            banners: {
                [Banner.PeoplesFavor]: { value: 5, mobSide: false, holderPlayerId: 'foe' },
                [Banner.DarkestSecret]: { value: 1 }
            }
        }
    )
    openTurn(s, 'me')
    return s
}

const conspiracy = { targetPlayerId: 'foe', take: { kind: 'banner' as const, banner: Banner.PeoplesFavor } }
const seizeWithConspiracy = buildAction(PlayFacedownAdviser, {
    playerId: 'me',
    cardId: CONSPIRACY_ID,
    play: SearchPlay.Conspiracy,
    conspiracy
})

function favorOf(state: { players: { playerId: string; favor: number }[] }, playerId: string) {
    return state.players.find((p) => p.playerId === playerId)?.favor
}

describe("R-10.4-H1 — the People's Favor burns a Seize's favor itself, so Vow of Renewal does not take it", () => {
    it("a Conspiracy's Seize burns the two to the shared bank and the Vow's holder gains nothing", () => {
        const s = table(atRevision)
        const supply = s.favorSupply
        const game = testGame(['me', 'foe', 'keeper', 'chancellor'])
        const after = engine.runNext(seizeWithConspiracy, s.dehydrate(), game).updatedState

        expect(after.banners[Banner.PeoplesFavor]).toMatchObject({ value: 3, holderPlayerId: 'me', mobSide: true })
        expect(after.favorSupply).toBe(supply + 2)
        expect(favorOf(after, 'keeper')).toBe(2)
    })

    it("a Campaign's Seize goes the same way: the helper both routes share", () => {
        const s = table(atRevision)
        const supply = s.favorSupply
        expectFavorConserved(s, () => {
            expect(seizeBanner(s, Banner.PeoplesFavor, 'me')).toBe(2)
        })
        expect(s.favorSupply).toBe(supply + 2)
        expect(s.getPlayerState('keeper').favor).toBe(2)
    })

    it('R-X.4 — in a game created before the revision, the Vow’s holder still takes the two', () => {
        const s = table(before)
        const supply = s.favorSupply
        const game = testGame(['me', 'foe', 'keeper', 'chancellor'])
        const after = engine.runNext(seizeWithConspiracy, s.dehydrate(), game).updatedState

        expect(after.banners[Banner.PeoplesFavor]).toMatchObject({ value: 3, holderPlayerId: 'me' })
        expect(after.favorSupply).toBe(supply)
        expect(favorOf(after, 'keeper')).toBe(4)
    })

    it('a burn a player performs, a cost, is still the Vow holder’s', () => {
        const s = table(atRevision)
        const supply = s.favorSupply
        expectFavorConserved(s, () => {
            payCostOnCard(s, 'me', CAPTAINS, { placeFavor: 0, burnFavor: 2, placeSecret: 0, burnSecret: 0 })
        })
        expect(s.getPlayerState('me').favor).toBe(0)
        expect(s.getPlayerState('keeper').favor).toBe(4)
        expect(s.favorSupply).toBe(supply)
    })

    it('R-X.4 — each revision’s Conspiracy Seize replays unchanged', () => {
        for (const [revision, keeperFavor] of [[before, 4], [atRevision, 2]]) {
            const start = table(revision).dehydrate()
            const game = testGame(['me', 'foe', 'keeper', 'chancellor'])
            const recorded = engine.runNext(seizeWithConspiracy, structuredClone(start), game)
            expect(favorOf(recorded.updatedState, 'keeper')).toBe(keeperFavor)

            let replayed = structuredClone(start)
            for (const action of recorded.processedActions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        }
    })
})

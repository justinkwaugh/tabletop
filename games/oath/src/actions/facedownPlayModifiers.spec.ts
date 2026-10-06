import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { SearchPlay } from './searchResolve.js'
import { Region, Suit } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { expectCountsMatchTheVault } from '../testing/census.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { modifierUse, region, yes } from '../testing/choices.js'
import { INN, TENTS } from '../testing/cards.js'
import { OathRevision } from '../util/revision.js'
import { OathVisibility } from '../definition/runtime.js'
import type { ModifierUse } from '../util/modifiers.js'
import '../powers/index.js'

const BOOK = 'relic.book-of-records'
const HORN = 'relic.cracked-horn'
const NEW_GROWTH = 'denizen.beast.new-growth'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const WILD_CRY = 'denizen.beast.wild-cry'
const BRACKEN = 'denizen.beast.bracken'
const PARTY = 'denizen.hearth.welcoming-party'
const AUGURY = 'denizen.arcane.augury'
const WOLVES = 'denizen.beast.wolves'

const atRevision = OathRevision.CostsAndFacedownModifiers

/** `me` is on turn at c1 (the Cradle) with `facedown` as a facedown adviser beside `faceup`. */
function table(
    facedown: string,
    faceup: string[] = [],
    relicIds: string[] = [],
    oathRevision: number | undefined = atRevision,
    c1: string[] = []
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
                relicIds,
                warbandsOnBoard: { me: 2 },
                warbandsInPersonalBank: { me: 6 },
                advisers: [{ cardId: facedown, faceUp: false }, ...faceup.map((cardId) => ({ cardId, faceUp: true }))]
            }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision,
            denizensBySite: { c1, c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { me: 1 }, c2: { foe: 1 } }
        }
    )
    openTurn(s, 'me')
    return s
}

function play(cardId: string, to: SearchPlay, extra: { modifiers?: ModifierUse[]; toSiteId?: string; discardFirstCardId?: string } = {}) {
    return new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, { playerId: 'me', cardId, play: to, ...extra }))
}

describe('R-6.1 — a facedown adviser’s play takes the Search modifiers a Search’s play would', () => {
    it('Book of Records: a site play gains one secret and no favor, and the record says so', () => {
        const s = table(INN, [], [BOOK])
        const bank = s.favorBank[Suit.Hearth]
        const a = play(INN, SearchPlay.Site)
        a.apply(s)

        expect(s.getPlayerState('me').secrets).toBe(3)
        expect(s.getPlayerState('me').favor).toBe(2)
        expect(s.favorBank[Suit.Hearth]).toBe(bank)
        expect(a.metadata?.favorGained).toBe(0)
        expect(a.metadata?.secretsGained).toBe(1)
        expect(a.metadata?.modifiers).toEqual([BOOK])
    })

    it('R-X.4 — in a game created before the revision, the same play gains favor as before', () => {
        const s = table(INN, [], [BOOK], OathRevision.TurnFlow)
        const a = play(INN, SearchPlay.Site)
        a.apply(s)

        expect(s.getPlayerState('me').secrets).toBe(2)
        expect(s.getPlayerState('me').favor).toBe(3)
        expect(a.metadata?.favorGained).toBe(1)
        expect(a.metadata?.secretsGained).toBeUndefined()
        expect(a.metadata?.modifiers).toBeUndefined()
        const declared = table(WOLVES, [NEW_GROWTH], [], OathRevision.TurnFlow)
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(declared, 'me', { cardId: WOLVES, play: SearchPlay.Site, toSiteId: 'p1', modifiers: [modifierUse(NEW_GROWTH)] })).toMatch(/before revision 2/)
    })

    it('Book of Records changes nothing on a play that is not to a site, and is not named there', () => {
        const s = table(INN, [], [BOOK])
        const a = play(INN, SearchPlay.Discard)
        a.apply(s)
        expect(s.getPlayerState('me').secrets).toBe(2)
        expect(a.metadata?.modifiers).toBeUndefined()
    })

    it('New Growth: a beast card goes to another site', () => {
        const s = table(WOLVES, [NEW_GROWTH])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: WOLVES, play: SearchPlay.Site, toSiteId: 'p1' })).toMatch(/only be played to your own site/)
        const growth = [modifierUse(NEW_GROWTH)]
        expect(HydratedPlayFacedownAdviser.reasonCannotPlace(s, 'me', { cardId: WOLVES, play: SearchPlay.Site, toSiteId: 'p1', modifiers: growth })).toBeUndefined()
        const a = play(WOLVES, SearchPlay.Site, { toSiteId: 'p1', modifiers: growth })
        a.apply(s)
        expect(s.denizensBySite['p1']).toEqual([WOLVES])
        expect(a.metadata?.modifiers).toEqual([NEW_GROWTH])
    })

    it('Crop Rotation: a denizen at the site is discarded first', () => {
        const s = table(TENTS, [CROP_ROTATION], [], atRevision, [INN])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: TENTS, play: SearchPlay.Site, discardFirstCardId: INN })).toMatch(/only the Great Slum, Crop Rotation/)
        const a = play(TENTS, SearchPlay.Site, { discardFirstCardId: INN, modifiers: [modifierUse(CROP_ROTATION)] })
        a.apply(s)
        expect(s.denizensBySite['c1']).toEqual([TENTS])
        expect(a.metadata?.discardedCardIds).toEqual([INN])
        expect(s.discardPileCounts[Region.Provinces]).toBe(1)
    })

    it('Wild Cry: a beast card played gains 1 Supply and 2 warbands', () => {
        const s = table(WOLVES, [WILD_CRY])
        const a = play(WOLVES, SearchPlay.Site, { modifiers: [modifierUse(WILD_CRY)] })
        a.apply(s)
        expect(s.getPlayerState('me').supply).toBe(4)
        expect(s.getPlayerState('me').warbandsInPersonalBank.me).toBe(4)
        expect(a.metadata?.modifierNotes).toEqual(['Wild Cry: gained 1 Supply and 2 warbands'])
    })

    it('Bracken and Cracked Horn: the discard branch sends the card where they say', () => {
        const bracken = table(WOLVES, [BRACKEN])
        const toBottom = play(WOLVES, SearchPlay.Discard, { modifiers: [modifierUse(BRACKEN, [region(Region.Hinterland), yes])] })
        toBottom.apply(bracken)
        expect(toBottom.metadata?.discardPileRegion).toBe(Region.Hinterland)
        expect(toBottom.metadata?.discardToBottom).toBe(true)
        expect(bracken.discardPileCounts[Region.Hinterland]).toBe(1)
        expect(bracken.discardPileCounts[Region.Provinces]).toBe(0)
        expect(bracken.requireVault().discardPiles[Region.Hinterland].at(-1)).toBe(WOLVES)
        expectCountsMatchTheVault(bracken)

        const horn = table(WOLVES, [], [HORN])
        const under = play(WOLVES, SearchPlay.Discard, { modifiers: [modifierUse(HORN)] })
        under.apply(horn)
        expect(under.metadata?.discardToWorldDeck).toBe(true)
        expect(horn.requireVault().worldDeck.at(-1)).toBe(WOLVES)
        expect(horn.discardPileCounts[Region.Provinces]).toBe(0)
        expectCountsMatchTheVault(horn)
    })

    it('Welcoming Party still pays nothing: its text excludes a facedown adviser', () => {
        const s = table(INN, [PARTY])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: INN, play: SearchPlay.Site, modifiers: [modifierUse(PARTY)] })).toBe(`${PARTY}: the card played is a facedown adviser`)
        const bank = s.favorBank[Suit.Hearth]
        play(INN, SearchPlay.Site).apply(s)
        expect(s.favorBank[Suit.Hearth]).toBe(bank - 1)
        expect(s.getPlayerState('me').favor).toBe(3)
    })

    it('a modifier that changes the draw is refused: this play draws nothing', () => {
        const s = table(INN, [AUGURY])
        expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'me', { cardId: INN, play: SearchPlay.Site, modifiers: [modifierUse(AUGURY)] })).toBe(`${AUGURY} changes a Search's draw, and this play draws nothing`)
        expect(() => play(INN, SearchPlay.Site, { modifiers: [modifierUse(AUGURY)] }).apply(s)).toThrow(/this play draws nothing/)
    })

    it('R-9.4 — another seat sees the modifier named on a discard, never the card discarded', () => {
        const s = table(WOLVES, [BRACKEN])
        const a = play(WOLVES, SearchPlay.Discard, { modifiers: [modifierUse(BRACKEN, [region(Region.Hinterland)])] })
        a.apply(s)
        const seen = JSON.stringify(OathVisibility.actions.project(a.dehydrate(), { kind: 'player', playerId: 'foe' }))
        expect(seen).toContain(BRACKEN)
        expect(seen).not.toContain(WOLVES)
    })

    it('R-X.4 — each revision’s facedown site play under Book of Records replays unchanged', () => {
        for (const revision of [OathRevision.TurnFlow, atRevision]) {
            const before = table(INN, [], [BOOK], revision).dehydrate()
            const game = testGame(['me', 'foe', 'chancellor'])
            const recorded = engine.runNext(buildAction(PlayFacedownAdviser, { playerId: 'me', cardId: INN, play: SearchPlay.Site }), structuredClone(before), game)
            const me = recorded.updatedState.players.find((p) => p.playerId === 'me')
            expect(me?.secrets).toBe(revision === atRevision ? 3 : 2)

            let replayed = structuredClone(before)
            for (const action of recorded.processedActions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        }
    })
})

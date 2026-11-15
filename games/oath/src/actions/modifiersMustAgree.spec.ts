import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { SearchPlay } from './searchResolve.js'
import { Region } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse, region, yes } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { expectCountsMatchTheVault } from '../testing/census.js'
import { FILLER, INN } from '../testing/cards.js'
import { discardTargetOf, searchPlayModifiers, type ModifierUse } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Law 7.4: "You can use multiple modifiers in any order to modify a given action." R-7.4-H2: from revision 31 two
// declared modifiers that answer the same question are accepted together only if their answers agree.

const ERRAND = 'denizen.beast.errand-boy'
const OBSERVATORY = 'denizen.arcane.observatory'
const MUSHROOMS = 'denizen.beast.mushrooms'
const BRACKEN = 'denizen.beast.bracken'
const HORN = 'relic.cracked-horn'
const WOLVES = 'denizen.beast.wolves'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }

const DISAGREE = (later: string, earlier: string, question: string) =>
    `${later} and ${earlier} give different answers to ${question} (R-7.4-H2)`
const PILE = 'the pile drawn from'
const DISCARDS = 'where the discards go'

const errandTo = (r: Region) => modifierUse(ERRAND, [region(r)])
const observatoryTo = (r: Region) => modifierUse(OBSERVATORY, [region(r)])
const brackenTo = modifierUse(BRACKEN, [region(Region.Hinterland), yes])
const horn = modifierUse(HORN)

/**
 * Dana on turn at c1 in the Cradle, with Errand Boy and Bracken as advisers, the Cracked Horn, and the
 * Observatory and Mushrooms at c1. Each region's discard pile holds four cards.
 */
function table(revision: OathRevision, facedown?: string): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                secrets: 2,
                supply: 5,
                relicIds: [HORN],
                advisers: [
                    { cardId: ERRAND, faceUp: true },
                    { cardId: BRACKEN, faceUp: true },
                    ...(facedown ? [{ cardId: facedown, faceUp: false }] : [])
                ]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [OBSERVATORY, MUSHROOMS], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            discardPileCounts: {
                [Region.Cradle]: 4,
                [Region.Provinces]: 4,
                [Region.Hinterland]: 4
            }
        }
    )
    openTurn(s, 'dana')
    const vault = s.requireVault()
    vault.worldDeck = [INN, FILLER, FILLER, FILLER]
    vault.discardPiles[Region.Cradle] = [FILLER, FILLER, FILLER, FILLER]
    vault.discardPiles[Region.Provinces] = [FILLER, FILLER, FILLER, INN]
    vault.discardPiles[Region.Hinterland] = [FILLER, FILLER, FILLER, FILLER]
    return s
}

const checkOf = (s: HydratedOathGameState, source: SearchSource, modifiers: ModifierUse[]) =>
    HydratedSearch.reasonCannotSearch(s, 'dana', source, modifiers)

function searched(s: HydratedOathGameState, source: SearchSource, modifiers: ModifierUse[]) {
    const action = new HydratedSearch(
        buildAction(Search, { playerId: 'dana', drawFrom: source, revealsInfo: true, modifiers })
    )
    action.apply(s)
    return action
}

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

describe('Bracken and the Cracked Horn on one Search: where the discards go (R-7.4-H2)', () => {
    it('declaring the Cracked Horn beside Bracken is refused, in either order, and nothing is paid', () => {
        const s = table(FIXED)
        expect(checkOf(s, SearchSource.WorldDeck, [brackenTo, horn])).toBe(
            DISAGREE(HORN, BRACKEN, DISCARDS)
        )
        expect(checkOf(s, SearchSource.WorldDeck, [horn, brackenTo])).toBe(
            DISAGREE(BRACKEN, HORN, DISCARDS)
        )
        expect(() => searched(s, SearchSource.WorldDeck, [brackenTo, horn])).toThrow(
            DISAGREE(HORN, BRACKEN, DISCARDS)
        )
        expect(s.getPlayerState('dana').supply).toBe(5)
        expect(s.requireVault().worldDeck).toHaveLength(4)
        expect(s.pendingSearchModifiers).toBeUndefined()
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('each alone is accepted, and carried to the play where its text says', () => {
        const withBracken = table(FIXED)
        searched(withBracken, SearchSource.WorldDeck, [brackenTo])
        expect(discardTargetOf(withBracken, 'dana', searchPlayModifiers(withBracken))).toEqual({
            region: Region.Hinterland,
            bottom: true
        })

        const withHorn = table(FIXED)
        searched(withHorn, SearchSource.WorldDeck, [horn])
        expect(discardTargetOf(withHorn, 'dana', searchPlayModifiers(withHorn))).toEqual({
            region: Region.Cradle,
            bottom: false,
            worldDeck: true
        })
    })

    it('before revision 31 both are accepted, and the first declared says where the discards go', () => {
        const s = table(BEFORE)
        expect(checkOf(s, SearchSource.WorldDeck, [brackenTo, horn])).toBeUndefined()
        searched(s, SearchSource.WorldDeck, [brackenTo, horn])
        expect(searchPlayModifiers(s).map((m) => m.power.cardId)).toEqual([BRACKEN, HORN])
        expect(discardTargetOf(s, 'dana', searchPlayModifiers(s))).toEqual({
            region: Region.Hinterland,
            bottom: true
        })
    })

    it("on Dana's own view: the same answers, with the state neither copied nor changed", () => {
        const s = table(FIXED)
        const server = JSON.stringify(s.dehydrate())
        const own = ownView(s)
        expect(checkOf(own, SearchSource.WorldDeck, [brackenTo, horn])).toBe(
            DISAGREE(HORN, BRACKEN, DISCARDS)
        )
        expect(checkOf(own, SearchSource.WorldDeck, [brackenTo])).toBeUndefined()
        expect(checkOf(own, SearchSource.WorldDeck, [horn])).toBeUndefined()
        expect(JSON.stringify(s.dehydrate())).toBe(server)

        const before = ownView(table(BEFORE))
        expect(checkOf(before, SearchSource.WorldDeck, [brackenTo, horn])).toBeUndefined()
    })
})

describe('Errand Boy and the Observatory on one Search: the pile drawn from (R-7.4-H2)', () => {
    it('naming different piles is refused, in either order', () => {
        const s = table(FIXED)
        expect(
            checkOf(s, SearchSource.Discard, [
                errandTo(Region.Provinces),
                observatoryTo(Region.Hinterland)
            ])
        ).toBe(DISAGREE(OBSERVATORY, ERRAND, PILE))
        expect(
            checkOf(s, SearchSource.Discard, [
                observatoryTo(Region.Hinterland),
                errandTo(Region.Provinces)
            ])
        ).toBe(DISAGREE(ERRAND, OBSERVATORY, PILE))
        expect(() =>
            searched(s, SearchSource.Discard, [
                errandTo(Region.Provinces),
                observatoryTo(Region.Hinterland)
            ])
        ).toThrow(DISAGREE(OBSERVATORY, ERRAND, PILE))
        expect(s.tokensOn(ERRAND).favor).toBe(0)
        expect(s.discardPileCounts[Region.Provinces]).toBe(4)
        expect(s.discardPileCounts[Region.Hinterland]).toBe(4)
    })

    it('naming the same pile is accepted: both are paid, and the draw is from that pile', () => {
        const s = table(FIXED)
        const both = [errandTo(Region.Provinces), observatoryTo(Region.Provinces)]
        expect(checkOf(s, SearchSource.Discard, both)).toBeUndefined()
        expect(HydratedSearch.drawRegion(s, 'dana', both)).toBe(Region.Provinces)
        const action = searched(s, SearchSource.Discard, both)
        expect(action.metadata?.modifiers).toEqual([ERRAND, OBSERVATORY])
        expect(action.metadata?.draw.discardRegion).toBe(Region.Provinces)
        expect(s.tokensOn(ERRAND).favor).toBe(1)
        expect(s.getPlayerState('dana').favor).toBe(3)
        expect(s.discardPileCounts[Region.Provinces]).toBe(1)
        expect(s.discardPileCounts[Region.Hinterland]).toBe(4)
        expect(s.discardPileCounts[Region.Cradle]).toBe(4)
        expectCountsMatchTheVault(s)
    })

    it('each alone is accepted and draws from the pile it names', () => {
        const s = table(FIXED)
        expect(checkOf(s, SearchSource.Discard, [errandTo(Region.Hinterland)])).toBeUndefined()
        expect(HydratedSearch.drawRegion(s, 'dana', [errandTo(Region.Hinterland)])).toBe(
            Region.Hinterland
        )
        expect(checkOf(s, SearchSource.Discard, [observatoryTo(Region.Provinces)])).toBeUndefined()
        expect(HydratedSearch.drawRegion(s, 'dana', [observatoryTo(Region.Provinces)])).toBe(
            Region.Provinces
        )
    })

    it('Errand Boy with Mushrooms is still accepted: one card from the bottom of the pile Errand Boy names', () => {
        const s = table(FIXED)
        const stacked = [errandTo(Region.Provinces), modifierUse(MUSHROOMS)]
        expect(checkOf(s, SearchSource.Discard, stacked)).toBeUndefined()
        const action = searched(s, SearchSource.Discard, stacked)
        expect(action.metadata?.draw.drawnCardIds).toEqual([INN])
        expect(s.discardPileCounts[Region.Provinces]).toBe(3)
        expect(s.getPlayerState('dana').supply).toBe(5)
        expect(s.tokensOn(ERRAND).favor).toBe(1)
        expect(s.tokensOn(MUSHROOMS).secrets).toBe(1)
    })

    it('before revision 31 different piles are accepted: the first declared names the pile, and both are paid', () => {
        const s = table(BEFORE)
        const both = [errandTo(Region.Provinces), observatoryTo(Region.Hinterland)]
        expect(checkOf(s, SearchSource.Discard, both)).toBeUndefined()
        expect(
            HydratedSearch.drawRegion(s, 'dana', [
                observatoryTo(Region.Hinterland),
                errandTo(Region.Provinces)
            ])
        ).toBe(Region.Hinterland)
        const action = searched(s, SearchSource.Discard, both)
        expect(action.metadata?.draw.discardRegion).toBe(Region.Provinces)
        expect(action.metadata?.modifiers).toEqual([ERRAND, OBSERVATORY])
        expect(s.tokensOn(ERRAND).favor).toBe(1)
        expect(s.discardPileCounts[Region.Provinces]).toBe(1)
        expect(s.discardPileCounts[Region.Hinterland]).toBe(4)
    })

    it("on Dana's own view: the same answers", () => {
        const own = ownView(table(FIXED))
        expect(
            checkOf(own, SearchSource.Discard, [
                errandTo(Region.Provinces),
                observatoryTo(Region.Hinterland)
            ])
        ).toBe(DISAGREE(OBSERVATORY, ERRAND, PILE))
        expect(
            checkOf(own, SearchSource.Discard, [
                errandTo(Region.Provinces),
                observatoryTo(Region.Provinces)
            ])
        ).toBeUndefined()
    })
})

describe('Bracken and the Cracked Horn on a facedown adviser’s play (R-6.1, R-7.4-H2)', () => {
    const discard = (modifiers: ModifierUse[]) => ({
        cardId: WOLVES,
        play: SearchPlay.Discard,
        modifiers
    })
    const checkPlay = (s: HydratedOathGameState, modifiers: ModifierUse[]) =>
        HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', discard(modifiers))
    function played(s: HydratedOathGameState, modifiers: ModifierUse[]) {
        const action = new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, { playerId: 'dana', ...discard(modifiers) })
        )
        action.apply(s)
        return action
    }

    it('declaring both is refused, as in a Search, and the adviser stays facedown', () => {
        const s = table(FIXED, WOLVES)
        expect(checkPlay(s, [brackenTo, horn])).toBe(DISAGREE(HORN, BRACKEN, DISCARDS))
        expect(checkPlay(s, [horn, brackenTo])).toBe(DISAGREE(BRACKEN, HORN, DISCARDS))
        expect(() => played(s, [brackenTo, horn])).toThrow(DISAGREE(HORN, BRACKEN, DISCARDS))
        expect(s.getPlayerState('dana').knownAdviser(WOLVES)?.faceUp).toBe(false)
        expect(s.searchModifiersInUse).toBeUndefined()
        expect(checkPlay(ownView(s), [brackenTo, horn])).toBe(DISAGREE(HORN, BRACKEN, DISCARDS))
    })

    it('each alone sends the discarded adviser where its text says', () => {
        const withBracken = table(FIXED, WOLVES)
        const toPile = played(withBracken, [brackenTo])
        expect(toPile.metadata?.discardPileRegion).toBe(Region.Hinterland)
        expect(toPile.metadata?.discardToBottom).toBe(true)
        expect(withBracken.requireVault().discardPiles[Region.Hinterland].at(-1)).toBe(WOLVES)

        const withHorn = table(FIXED, WOLVES)
        const under = played(withHorn, [horn])
        expect(under.metadata?.discardToWorldDeck).toBe(true)
        expect(withHorn.requireVault().worldDeck.at(-1)).toBe(WOLVES)
    })

    it('before revision 31 both are accepted, and the first declared says where the adviser goes', () => {
        const s = table(BEFORE, WOLVES)
        expect(checkPlay(s, [brackenTo, horn])).toBeUndefined()
        const action = played(s, [brackenTo, horn])
        expect(action.metadata?.discardPileRegion).toBe(Region.Hinterland)
        expect(action.metadata?.discardToWorldDeck).toBeUndefined()
        expect(s.requireVault().discardPiles[Region.Hinterland].at(-1)).toBe(WOLVES)
        expect(s.requireVault().worldDeck).toHaveLength(4)
    })
})

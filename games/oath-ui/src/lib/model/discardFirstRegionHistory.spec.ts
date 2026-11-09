import { describe, expect, it } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import {
    ActionType,
    HydratedPlayFacedownAdviser,
    HydratedSearch,
    HydratedSearchResolve,
    OathRevision,
    PlayFacedownAdviser,
    PowerTiming,
    Search,
    SearchPlay,
    SearchResolve,
    SearchSource,
    powerIndexOf,
    type HydratedOathGameState
} from '@tabletop/oath'
import {
    buildAction,
    openTurn,
    testPlayer,
    testState,
    withChancellor
} from '@tabletop/oath/testing'
import { describeAction, type HistoryNames } from './actionDescription.js'

// Law, Glossary, "Discard": "If discarding cards in a different region from your pawn, discard based on the
// region of the card instead." From revision 33 a card discarded first at a site in another region goes to the
// pile after its own region's, and its History names that pile; before it, the pile after the pawn's region.

const NEW_GROWTH = 'denizen.beast.new-growth'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const INN = 'denizen.hearth.wayside-inn'
const FILLER = 'denizen.order.wrestlers'
const SCOUTS = 'denizen.order.scouts'
const TENTS = 'denizen.nomad.tents'
const LONGBOWS = 'denizen.order.longbows'
const SLUM = 'site.great-slums'

const names: HistoryNames = {
    player: (playerId) => ({ dana: 'Dana', rhys: 'Rhys' })[playerId] ?? playerId,
    site: (slotId) => slotId,
    seats: ['dana', 'rhys']
}

const use = (cardId: string) => ({
    cardId,
    powerIndex: powerIndexOf(cardId, PowerTiming.Modifier)
})

/** The History row of an action the engine applied (its fields and its metadata), as `viewerId` reads it. */
function historyOf(
    fields: { type: ActionType } & Record<string, unknown>,
    viewerId: string
): string {
    const action: GameAction = { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
    return describeAction(action, names, viewerId)
}

/** Dana at c1 (Cradle) with New Growth and Crop Rotation faceup; p1 (Provinces) holds Scouts, Tents and Longbows. */
function table(revision: OathRevision, p1Site?: string): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                advisers: [
                    { cardId: NEW_GROWTH, faceUp: true },
                    { cardId: CROP_ROTATION, faceUp: true }
                ]
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'c2', favor: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [SCOUTS, TENTS, LONGBOWS], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            ...(p1Site
                ? {
                      siteCards: {
                          c1: 'site.river',
                          c2: 'site.river',
                          p1: p1Site,
                          h1: 'site.mountain'
                      }
                  }
                : {})
        }
    )
    openTurn(s, 'dana')
    return s
}

/** Dana searches the world deck with both, keeps the Inn and plays it to p1, discarding Scouts there first. */
function searchRow(revision: OathRevision, viewerId: string): string {
    const s = table(revision)
    s.requireVault().worldDeck = [INN, FILLER, FILLER]
    new HydratedSearch(
        buildAction(Search, {
            playerId: 'dana',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [use(NEW_GROWTH), use(CROP_ROTATION)]
        })
    ).apply(s)
    const fields = {
        type: ActionType.SearchResolve as const,
        playerId: 'dana',
        keptCardId: INN,
        discardOrder: [FILLER, FILLER],
        play: SearchPlay.Site,
        toSiteId: 'p1',
        discardFirstCardId: SCOUTS
    }
    const resolved = new HydratedSearchResolve(buildAction(SearchResolve, fields))
    resolved.apply(s)
    return historyOf({ ...fields, metadata: resolved.metadata }, viewerId)
}

/** Dana has the Inn facedown and plays it faceup to p1's Great Slum by New Growth, discarding Scouts first. */
function facedownRow(revision: OathRevision, viewerId: string): string {
    const s = table(revision, SLUM)
    s.getPlayerState('dana').addAdviser(INN, false)
    const fields = {
        type: ActionType.PlayFacedownAdviser as const,
        playerId: 'dana',
        cardId: INN,
        play: SearchPlay.Site,
        toSiteId: 'p1',
        discardFirstCardId: SCOUTS,
        modifiers: [use(NEW_GROWTH)]
    }
    const played = new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, fields))
    played.apply(s)
    return historyOf({ ...fields, metadata: played.metadata }, viewerId)
}

const SEARCH_ROW = 'discarding Scouts first, gaining 1 favor'

describe('History names the pile a card discarded first in another region went to', () => {
    it('revision 33, the Search: the two drawn to the provinces pile, Scouts to the hinterland pile', () => {
        expect(searchRow(OathRevision.EngineFixes28, 'dana')).toContain(
            `${SEARCH_ROW}; Wrestlers, Wrestlers went to the provinces discard pile; ` +
                'Scouts went to the hinterland discard pile'
        )
        expect(searchRow(OathRevision.EngineFixes28, 'rhys')).toContain(
            '2 cards went to the provinces discard pile; cards went to the hinterland discard pile'
        )
    })

    it('revision 32, the Search: all three to the provinces pile, as recorded', () => {
        expect(searchRow(OathRevision.EngineFixes27, 'dana')).toContain(
            `${SEARCH_ROW}; Wrestlers, Wrestlers, Scouts went to the provinces discard pile`
        )
        expect(searchRow(OathRevision.EngineFixes27, 'rhys')).toContain(
            '3 cards went to the provinces discard pile'
        )
    })

    it('revision 33, the facedown adviser play: Scouts to the hinterland pile', () => {
        expect(facedownRow(OathRevision.EngineFixes28, 'dana')).toContain(
            'played Wayside Inn to p1 (New Growth), discarding Scouts first, gaining 1 favor; ' +
                'Scouts went to the hinterland discard pile'
        )
    })

    it('revision 32, the facedown adviser play: no pile named, as before', () => {
        expect(facedownRow(OathRevision.EngineFixes27, 'dana')).not.toContain('discard pile')
    })
})

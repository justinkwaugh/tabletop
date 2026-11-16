import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { HydratedAnswerQuestion } from './answerQuestion.js'
import { HydratedPlayFacedownAdviser } from './playFacedownAdviser.js'
import { PowerQuestionKind } from '../model/question.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { TENTS } from '../testing/cards.js'
import { CONSPIRACY_ID } from '../data/visions.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// R-5.1.4.II — only a card played as an adviser discards one to make room. From revision 33 an adviser named to
// discard for any other play is refused; before it (R-X.4) the play was accepted and the adviser stayed.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const SONGS = 'denizen.hearth.tavern-songs'
const ALCHEMIST = 'denizen.arcane.alchemist'
const LONGBOWS = 'denizen.order.longbows'
const RANGERS = 'denizen.beast.rangers'
const CAPTAINS = 'denizen.order.captains'
const CONQUEST = 'vision.conquest'
const FAITH = 'vision.faith'
const DANA = 'dana'
const RHYS = 'rhys'

const REFUSED = 'an adviser is discarded only for a card played as an adviser'
const SECOND_REFUSED = `second card: ${REFUSED}`

const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }

interface Table {
    revision: OathRevision
    c1?: string[]
    top?: string[]
    advisers?: string[]
    facedown?: string[]
    rhysAdvisers?: string[]
    revealed?: string
    danaOnRevealed?: boolean
}

// Dana, an Exile at the full Great Slum with Land Warden; the World Deck stops Land Warden's draw at the Vision of
// Conquest, so Dana holds Alchemist and the Vision.
function table({
    revision,
    c1 = [WOLVES, TENTS, SONGS],
    top = [ALCHEMIST, CONQUEST, LONGBOWS],
    advisers = [],
    facedown = [],
    rhysAdvisers = [],
    revealed,
    danaOnRevealed = false
}: Table): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                warbandsInPersonalBank: { [DANA]: 5 },
                ...(revealed ? { revealedVisionId: revealed } : {}),
                advisers: [
                    ...[LAND_WARDEN, ...advisers].map((cardId) => ({ cardId, faceUp: true })),
                    ...facedown.map((cardId) => ({ cardId, faceUp: false }))
                ]
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Blue,
                siteId: 'c2',
                favor: 2,
                secrets: 2,
                warbandsInPersonalBank: { [RHYS]: 5 },
                advisers: rhysAdvisers.map((cardId) => ({ cardId, faceUp: true }))
            })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1, c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [DANA]: 1 } },
            siteCards: {
                c1: 'site.great-slums',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            ...(revealed && danaOnRevealed
                ? { warbandsOnCards: { [revealed]: { [DANA]: 1 } } }
                : {})
        }
    )
    openTurn(s, DANA)
    s.requireVault().worldDeck = [...top]
    return s
}

function searched(t: Table): HydratedOathGameState {
    const s = table(t)
    new HydratedSearch(
        buildAction(Search, {
            playerId: DANA,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [modifierUse(LAND_WARDEN)]
        })
    ).apply(s)
    return s
}

// Alchemist to the full Great Slum, the Wolves first, and the Vision second to Dana's Revealed Vision space.
function wardenPair(more: Partial<SearchResolveChoice> = {}): SearchResolveChoice {
    return {
        keptCardId: ALCHEMIST,
        discardOrder: [],
        play: SearchPlay.Site,
        discardFirstCardId: WOLVES,
        secondPlay: { cardId: CONQUEST, play: SearchPlay.RevealedVision },
        ...more
    }
}

const secondVisionNaming = (discardedAdviserCardIds: string[]) =>
    wardenPair({
        secondPlay: { cardId: CONQUEST, play: SearchPlay.RevealedVision, discardedAdviserCardIds }
    })

// The kept card's own play, one card kept and the other discarded.
const keptVision = (more: Partial<SearchResolveChoice> = {}): SearchResolveChoice => ({
    keptCardId: CONQUEST,
    discardOrder: [ALCHEMIST],
    play: SearchPlay.RevealedVision,
    ...more
})
const keptToSite = (more: Partial<SearchResolveChoice> = {}): SearchResolveChoice => ({
    keptCardId: ALCHEMIST,
    discardOrder: [CONQUEST],
    play: SearchPlay.Site,
    discardFirstCardId: WOLVES,
    ...more
})
const keptDiscarded = (more: Partial<SearchResolveChoice> = {}): SearchResolveChoice => ({
    keptCardId: ALCHEMIST,
    discardOrder: [CONQUEST],
    play: SearchPlay.Discard,
    ...more
})
const keptAsAdviser = (more: Partial<SearchResolveChoice> = {}): SearchResolveChoice => ({
    keptCardId: ALCHEMIST,
    discardOrder: [CONQUEST],
    play: SearchPlay.Adviser,
    faceUp: true,
    ...more
})

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, DANA, choice)

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice) {
    new HydratedSearchResolve(buildAction(SearchResolve, { playerId: DANA, ...choice })).apply(s)
}

const naming = { discardedAdviserCardIds: [RANGERS] }
const namingNone = { discardedAdviserCardIds: [] }

const keptCases: [string, (more?: Partial<SearchResolveChoice>) => SearchResolveChoice][] = [
    ['the kept Vision to the Revealed Vision space', keptVision],
    ['the kept denizen to the site', keptToSite],
    ['the kept card discarded', keptDiscarded]
]

describe('from revision 33 an adviser is discarded only for a card played as an adviser (R-5.1.4.II)', () => {
    const at33 = () => searched({ revision: OathRevision.EngineFixes28, advisers: [RANGERS] })

    it('the scene: Dana holds Alchemist and the Vision of Conquest, with room for an adviser', () => {
        const s = at33()
        expect(s.getPlayerState(DANA).knownHand()).toEqual([ALCHEMIST, CONQUEST])
        expect(checkOf(s, wardenPair())).toBeUndefined()
        expect(checkOf(s, keptAsAdviser())).toBeUndefined()
    })

    it("Land Warden: an adviser named to discard for the Vision second to the Revealed Vision space is refused, on Dana's own view too", () => {
        const s = at33()
        const choice = secondVisionNaming([RANGERS])
        expect(checkOf(s, choice)).toBe(SECOND_REFUSED)
        expect(checkOf(ownView(s), choice)).toBe(SECOND_REFUSED)
    })

    it('Land Warden: so the Search cannot resolve, and the adviser named stays', () => {
        const s = at33()
        expect(() => resolve(s, secondVisionNaming([RANGERS]))).toThrow(REFUSED)
        expect(s.getPlayerState(DANA).knownAdviserIds()).toContain(RANGERS)
    })

    it("Land Warden: an adviser that is not Dana's, named for the second Vision, is refused the same way", () => {
        const s = searched({
            revision: OathRevision.EngineFixes28,
            advisers: [RANGERS],
            rhysAdvisers: [CAPTAINS]
        })
        expect(checkOf(s, secondVisionNaming([CAPTAINS]))).toBe(SECOND_REFUSED)
    })

    it('Land Warden: an empty list for the second Vision is still accepted', () => {
        const s = at33()
        expect(checkOf(s, secondVisionNaming([]))).toBeUndefined()
        expect(checkOf(ownView(s), secondVisionNaming([]))).toBeUndefined()
    })

    for (const [name, kept] of keptCases) {
        it(`${name}, with an adviser named to discard: refused, on Dana's own view too`, () => {
            const s = at33()
            expect(checkOf(s, kept())).toBeUndefined()
            expect(checkOf(s, kept(naming))).toBe(REFUSED)
            expect(checkOf(ownView(s), kept(naming))).toBe(REFUSED)
        })

        it(`${name}, with an empty list: still accepted`, () => {
            const s = at33()
            expect(checkOf(s, kept(namingNone))).toBeUndefined()
            expect(checkOf(ownView(s), kept(namingNone))).toBeUndefined()
        })
    }

    it('the kept card played as the Conspiracy, with an adviser named: refused', () => {
        const s = searched({
            revision: OathRevision.EngineFixes28,
            advisers: [RANGERS],
            top: [CONSPIRACY_ID, ALCHEMIST]
        })
        const choice: SearchResolveChoice = {
            keptCardId: CONSPIRACY_ID,
            discardOrder: s
                .getPlayerState(DANA)
                .knownHand()
                .filter((id) => id !== CONSPIRACY_ID),
            play: SearchPlay.Conspiracy
        }
        expect(checkOf(s, choice)).toBeUndefined()
        expect(checkOf(s, { ...choice, ...naming })).toBe(REFUSED)
    })

    it('control: the kept card as an adviser with room still refuses a discard, as before', () => {
        const s = at33()
        expect(checkOf(s, keptAsAdviser(naming))).toBe(
            'cannot discard an adviser without being at the limit'
        )
    })

    it('control: the kept card as an adviser at the limit takes the adviser named', () => {
        const s = searched({ revision: OathRevision.EngineFixes28, advisers: [RANGERS, CAPTAINS] })
        expect(checkOf(s, keptAsAdviser())).toContain('adviser limit')
        expect(checkOf(s, keptAsAdviser(naming))).toBeUndefined()
        expect(checkOf(ownView(s), keptAsAdviser(naming))).toBeUndefined()
    })

    it("a facedown adviser played faceup (R-6.1) to a site or discarded, with an adviser named: refused, on Dana's own view too", () => {
        const s = table({
            revision: OathRevision.EngineFixes28,
            c1: [WOLVES],
            advisers: [RANGERS],
            facedown: [ALCHEMIST]
        })
        for (const play of [SearchPlay.Site, SearchPlay.Discard]) {
            const choice = { cardId: ALCHEMIST, play }
            expect(HydratedPlayFacedownAdviser.reasonCannotPlay(s, DANA, choice)).toBeUndefined()
            expect(
                HydratedPlayFacedownAdviser.reasonCannotPlay(s, DANA, { ...choice, ...naming })
            ).toBe(REFUSED)
            expect(
                HydratedPlayFacedownAdviser.reasonCannotPlay(ownView(s), DANA, {
                    ...choice,
                    ...naming
                })
            ).toBe(REFUSED)
            expect(
                HydratedPlayFacedownAdviser.reasonCannotPlace(s, DANA, { ...choice, ...naming })
            ).toBe(REFUSED)
        }
    })

    it("False Prophet's Vision played to the Revealed Vision space or discarded, with an adviser named: refused", () => {
        const s = searched({
            revision: OathRevision.EngineFixes28,
            advisers: [RANGERS],
            revealed: FAITH,
            danaOnRevealed: true
        })
        resolve(s, wardenPair())
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.PlayOrDiscardVision,
            askedPlayerId: DANA,
            visionCardId: FAITH
        })
        for (const play of [SearchPlay.RevealedVision, SearchPlay.Discard]) {
            const answer = { kind: PowerQuestionKind.PlayOrDiscardVision as const, play }
            expect(HydratedAnswerQuestion.reasonCannotAnswer(s, DANA, answer)).toBeUndefined()
            expect(
                HydratedAnswerQuestion.reasonCannotAnswer(s, DANA, {
                    ...answer,
                    discardedAdviserCardId: RANGERS
                })
            ).toBe(REFUSED)
        }
    })
})

describe('before revision 33 a game keeps the plays it was recorded with', () => {
    const at32 = () => searched({ revision: OathRevision.EngineFixes27, advisers: [RANGERS] })

    it('Land Warden: the Vision second to the Revealed Vision space with an adviser named is accepted, and the adviser stays', () => {
        const s = at32()
        const choice = secondVisionNaming([RANGERS])
        expect(checkOf(s, choice)).toBeUndefined()
        expect(checkOf(ownView(s), choice)).toBeUndefined()
        resolve(s, choice)
        const player = s.getPlayerState(DANA)
        expect(player.revealedVisionId).toBe(CONQUEST)
        expect(player.knownAdviserIds()).toContain(RANGERS)
    })

    for (const [name, kept] of keptCases) {
        it(`${name}, with an adviser named to discard: accepted, and the adviser stays`, () => {
            const s = at32()
            expect(checkOf(s, kept(naming))).toBeUndefined()
            expect(checkOf(ownView(s), kept(naming))).toBeUndefined()
            resolve(s, kept(naming))
            expect(s.getPlayerState(DANA).knownAdviserIds()).toContain(RANGERS)
        })
    }

    it('a facedown adviser played faceup (R-6.1) to a site or discarded, with an adviser named: accepted', () => {
        const s = table({
            revision: OathRevision.EngineFixes27,
            c1: [WOLVES],
            advisers: [RANGERS],
            facedown: [ALCHEMIST]
        })
        for (const play of [SearchPlay.Site, SearchPlay.Discard])
            expect(
                HydratedPlayFacedownAdviser.reasonCannotPlay(s, DANA, {
                    cardId: ALCHEMIST,
                    play,
                    ...naming
                })
            ).toBeUndefined()
    })

    it("False Prophet's Vision discarded with an adviser named: accepted", () => {
        const s = searched({
            revision: OathRevision.EngineFixes27,
            advisers: [RANGERS],
            revealed: FAITH,
            danaOnRevealed: true
        })
        resolve(s, wardenPair())
        expect(
            HydratedAnswerQuestion.reasonCannotAnswer(s, DANA, {
                kind: PowerQuestionKind.PlayOrDiscardVision,
                play: SearchPlay.Discard,
                discardedAdviserCardId: RANGERS
            })
        ).toBeUndefined()
    })
})

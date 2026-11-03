import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedUseActionPower, UseActionPower } from './useActionPower.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { HydratedSearch, Search, SearchSource } from './search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from './searchResolve.js'
import { HydratedAnswerQuestion } from './answerQuestion.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { answerQuestion } from '../testing/steps.js'
import { FILLER, INN } from '../testing/cards.js'
import { GREAT_SPIRE, WOLVES, placeEdifice } from '../testing/edifices.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { FALSE_PROPHET_ID } from '../util/revealedVision.js'
import type { ModifierUse } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Law 6.1 plays a facedown adviser "as if you searched (5.1.4)... Restrictions and modifiers apply", and Oracle's
// draw and False Prophet's Vision are played the same way. Law 7.4 and 7.4.1: a modifier is optional and is used
// at the start of the action it modifies. From revision 33 a declared Search modifier that cannot act on this play
// or draw is refused, before anything is paid, with the reason it cannot act: one that changes a Search's draw
// (Great Spire's swap, as the Truthful Harp and Augury already were), one that acts only on a play to a site (New
// Growth) when the play is not to a site, and one that acts only when a denizen is played (Welcoming Party) when the
// card played is a Vision. Before revision 33 a game keeps what it accepted.

const ORACLE = 'denizen.nomad.oracle'
const NEW_GROWTH = 'denizen.beast.new-growth'
const WELCOMING_PARTY = 'denizen.hearth.welcoming-party'
const WILD_CRY = 'denizen.beast.wild-cry'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const AUGURY = 'denizen.arcane.augury'
const HORN = 'relic.cracked-horn'
const FORCED_LABOR = 'denizen.order.forced-labor'
const SUPREMACY = 'vision.supremacy'
const FAITH = 'vision.faith'
const CONQUEST = 'vision.conquest'

const DANA = 'dana'
const RHYS = 'rhys'
const MARA = 'mara'

const FIXED = OathRevision.EngineFixes28
const BEFORE = OathRevision.EngineFixes27

const SPIRE_USE = modifierUse(GREAT_SPIRE)
const NEW_GROWTH_USE = modifierUse(NEW_GROWTH)
const WELCOMING_USE = modifierUse(WELCOMING_PARTY)
const WILD_CRY_USE = modifierUse(WILD_CRY)
const CROP_ROTATION_USE = modifierUse(CROP_ROTATION)
const AUGURY_USE = modifierUse(AUGURY)
const HORN_USE = modifierUse(HORN)

const danaView: Visibility.Perspective = { kind: 'player', playerId: DANA }
const rhysView: Visibility.Perspective = { kind: 'player', playerId: RHYS }

/** A player's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState, view: Visibility.Perspective) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)

const SPIRE_DRAWS_NOTHING = `${GREAT_SPIRE} changes a Search's draw, and this play draws nothing`
const SPIRE_OWN_TEXT = `${GREAT_SPIRE} changes a Search's draw, and this power draws by its own text`
const AUGURY_DRAWS_NOTHING = `${AUGURY} changes a Search's draw, and this play draws nothing`
const AUGURY_OWN_TEXT = `${AUGURY} changes a Search's draw, and this power draws by its own text`
const GROWTH_NOT_TO_SITE = `${NEW_GROWTH} acts on a play to a site, and this play is not to a site`
const CROP_NOT_TO_SITE = `${CROP_ROTATION} acts on a play to a site, and this play is not to a site`
const GROWTH_VISION = `${NEW_GROWTH} acts on a play to a site, and this Vision is not played to a site`
const GROWTH_ORACLE = `${NEW_GROWTH} acts on a play to a site, and the Vision this power draws is never played to a site`
const WELCOMING_VISION = `${WELCOMING_PARTY} acts when a denizen is played, and the card played is a Vision`
const WELCOMING_FACEDOWN = `${WELCOMING_PARTY}: the card played is a facedown adviser`

// --- Oracle: "Draw the Vision closest to the top of the world deck. Play or discard it as if you searched." ---

/** Dana on turn at c1 with Oracle and Great Spire there, holding the Cracked Horn; the next Vision is Supremacy. */
function oracleTable(revision: OathRevision, advisers: string[] = []): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 3,
                supply: 6,
                relicIds: [HORN],
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: RHYS, color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [ORACLE], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [DANA]: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, DANA)
    s.requireVault().worldDeck = [INN, SUPREMACY, FILLER]
    placeEdifice(s, 'c1', GREAT_SPIRE)
    return s
}

const oracleReason = (s: HydratedOathGameState, modifiers: ModifierUse[]) =>
    HydratedUseActionPower.reasonCannotUse(
        s,
        DANA,
        ORACLE,
        powerIndexOf(ORACLE, PowerTiming.Action),
        [],
        modifiers
    )

function useOracle(s: HydratedOathGameState, modifiers: ModifierUse[]): void {
    new HydratedUseActionPower(
        buildAction(UseActionPower, {
            playerId: DANA,
            cardId: ORACLE,
            powerIndex: powerIndexOf(ORACLE, PowerTiming.Action),
            modifiers
        })
    ).apply(s)
}

describe('Oracle’s use: a declared modifier that cannot act on its draw is refused (revision 33)', () => {
    it('Great Spire: refused, as it changes a Search’s draw, and no secret is placed', () => {
        const s = oracleTable(FIXED)
        expect(oracleReason(s, [SPIRE_USE])).toBe(SPIRE_OWN_TEXT)
        expect(() => useOracle(s, [SPIRE_USE])).toThrow(SPIRE_OWN_TEXT)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(0)
        expect(s.getPlayerState(DANA).secrets).toBe(3)
        expect(s.getPlayerState(DANA).knownHand()).toEqual([])
    })

    it('New Growth: refused, as the Vision drawn is never played to a site', () => {
        const s = oracleTable(FIXED, [NEW_GROWTH])
        expect(oracleReason(s, [NEW_GROWTH_USE])).toBe(GROWTH_ORACLE)
    })

    it('Welcoming Party: refused, as the card played is a Vision, not a denizen', () => {
        const s = oracleTable(FIXED, [WELCOMING_PARTY])
        expect(oracleReason(s, [WELCOMING_USE])).toBe(WELCOMING_VISION)
    })

    it('Augury: refused as before', () => {
        const s = oracleTable(FIXED, [AUGURY])
        expect(oracleReason(s, [AUGURY_USE])).toBe(AUGURY_OWN_TEXT)
    })

    it('control: with no modifier, or the Cracked Horn, the use is accepted and Oracle’s cost is all that is paid', () => {
        const s = oracleTable(FIXED)
        expect(oracleReason(s, [])).toBeUndefined()
        expect(oracleReason(s, [HORN_USE])).toBeUndefined()
        useOracle(s, [HORN_USE])
        expect(s.getPlayerState(DANA).secrets).toBe(1)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(0)
        expect(s.getPlayerState(DANA).knownHand()).toEqual([SUPREMACY])
    })

    it('Wild Cry, which only an after-play hook carries, is accepted as before', () => {
        const s = oracleTable(FIXED, [WILD_CRY])
        expect(oracleReason(s, [WILD_CRY_USE])).toBeUndefined()
    })

    it('Dana’s own projected view gives the same answers', () => {
        const s = oracleTable(FIXED, [NEW_GROWTH, WELCOMING_PARTY])
        const own = ownView(s, danaView)
        expect(oracleReason(own, [SPIRE_USE])).toBe(SPIRE_OWN_TEXT)
        expect(oracleReason(own, [NEW_GROWTH_USE])).toBe(GROWTH_ORACLE)
        expect(oracleReason(own, [WELCOMING_USE])).toBe(WELCOMING_VISION)
        expect(oracleReason(own, [HORN_USE])).toBeUndefined()
    })
})

describe('Oracle’s use in a game created before revision 33 keeps what it accepted', () => {
    it('Great Spire: accepted, and its secret placed', () => {
        const s = oracleTable(BEFORE)
        expect(oracleReason(s, [SPIRE_USE])).toBeUndefined()
        useOracle(s, [SPIRE_USE])
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(1)
        expect(s.getPlayerState(DANA).secrets).toBe(0)
    })

    it('New Growth and Welcoming Party: accepted', () => {
        const s = oracleTable(BEFORE, [NEW_GROWTH, WELCOMING_PARTY])
        expect(oracleReason(s, [NEW_GROWTH_USE])).toBeUndefined()
        expect(oracleReason(s, [WELCOMING_USE])).toBeUndefined()
    })

    it('Augury: refused', () => {
        const s = oracleTable(BEFORE, [AUGURY])
        expect(oracleReason(s, [AUGURY_USE])).toBe(AUGURY_OWN_TEXT)
    })
})

// --- R-6.1: a facedown adviser played "as if you searched", which draws nothing. ---

/** Dana on turn at c1 (which they rule, with Great Spire there) with Wolves (a beast) as a facedown adviser. */
function facedownTable(revision: OathRevision, advisers: string[] = []): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 3,
                supply: 6,
                advisers: [
                    { cardId: WOLVES, faceUp: false },
                    ...advisers.map((cardId) => ({ cardId, faceUp: true }))
                ]
            }),
            testPlayer({ playerId: RHYS, color: Color.Blue, siteId: 'c2', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [DANA]: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, DANA)
    s.requireVault().worldDeck = [INN, SUPREMACY, FILLER]
    placeEdifice(s, 'c1', GREAT_SPIRE)
    return s
}

const facedownReason = (s: HydratedOathGameState, play: SearchPlay, modifiers: ModifierUse[]) =>
    HydratedPlayFacedownAdviser.reasonCannotPlay(s, DANA, { cardId: WOLVES, play, modifiers })

function playFacedown(s: HydratedOathGameState, play: SearchPlay, modifiers: ModifierUse[]): void {
    new HydratedPlayFacedownAdviser(
        buildAction(PlayFacedownAdviser, { playerId: DANA, cardId: WOLVES, play, modifiers })
    ).apply(s)
}

describe('R-6.1 facedown play: a declared modifier that cannot act on it is refused (revision 33)', () => {
    it('Great Spire on a play to the site: refused, as this play draws nothing, and no secret is placed', () => {
        const s = facedownTable(FIXED)
        expect(facedownReason(s, SearchPlay.Site, [SPIRE_USE])).toBe(SPIRE_DRAWS_NOTHING)
        expect(() => playFacedown(s, SearchPlay.Site, [SPIRE_USE])).toThrow(SPIRE_DRAWS_NOTHING)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(0)
        expect(s.getPlayerState(DANA).secrets).toBe(3)
        expect(s.denizensAt('c1')).not.toContain(WOLVES)
    })

    it('Great Spire on the discard: refused', () => {
        const s = facedownTable(FIXED)
        expect(facedownReason(s, SearchPlay.Discard, [SPIRE_USE])).toBe(SPIRE_DRAWS_NOTHING)
    })

    it('New Growth on the card turned faceup as an adviser, or discarded: refused, as neither is a site play', () => {
        const s = facedownTable(FIXED, [NEW_GROWTH])
        expect(facedownReason(s, SearchPlay.Adviser, [NEW_GROWTH_USE])).toBe(GROWTH_NOT_TO_SITE)
        expect(facedownReason(s, SearchPlay.Discard, [NEW_GROWTH_USE])).toBe(GROWTH_NOT_TO_SITE)
    })

    it('New Growth on a play to the site: accepted', () => {
        const s = facedownTable(FIXED, [NEW_GROWTH])
        expect(facedownReason(s, SearchPlay.Site, [NEW_GROWTH_USE])).toBeUndefined()
    })

    it('Crop Rotation on the card turned faceup as an adviser: refused, as it is not a site play', () => {
        const s = facedownTable(FIXED, [CROP_ROTATION])
        expect(facedownReason(s, SearchPlay.Adviser, [CROP_ROTATION_USE])).toBe(CROP_NOT_TO_SITE)
    })

    it('Wild Cry on the beast played to the site: it acts, so it is accepted and gains', () => {
        const s = facedownTable(FIXED, [WILD_CRY])
        expect(facedownReason(s, SearchPlay.Site, [WILD_CRY_USE])).toBeUndefined()
        const supply = s.getPlayerState(DANA).supply
        playFacedown(s, SearchPlay.Site, [WILD_CRY_USE])
        expect(s.denizensAt('c1')).toContain(WOLVES)
        expect(s.getPlayerState(DANA).supply).toBe(supply + 1)
    })

    it('Welcoming Party: refused, as the card played is a facedown adviser', () => {
        const s = facedownTable(FIXED, [WELCOMING_PARTY])
        expect(facedownReason(s, SearchPlay.Site, [WELCOMING_USE])).toBe(WELCOMING_FACEDOWN)
    })

    it('Augury: refused as before', () => {
        const s = facedownTable(FIXED, [AUGURY])
        expect(facedownReason(s, SearchPlay.Site, [AUGURY_USE])).toBe(AUGURY_DRAWS_NOTHING)
    })

    it('Dana’s own projected view gives the same answers', () => {
        const s = facedownTable(FIXED, [NEW_GROWTH])
        const own = ownView(s, danaView)
        expect(facedownReason(own, SearchPlay.Site, [SPIRE_USE])).toBe(SPIRE_DRAWS_NOTHING)
        expect(facedownReason(own, SearchPlay.Adviser, [NEW_GROWTH_USE])).toBe(GROWTH_NOT_TO_SITE)
        expect(facedownReason(own, SearchPlay.Site, [NEW_GROWTH_USE])).toBeUndefined()
    })
})

describe('R-6.1 facedown play in a game created before revision 33 keeps what it accepted', () => {
    it('Great Spire on a play to the site: accepted, and its secret placed', () => {
        const s = facedownTable(BEFORE)
        expect(facedownReason(s, SearchPlay.Site, [SPIRE_USE])).toBeUndefined()
        playFacedown(s, SearchPlay.Site, [SPIRE_USE])
        expect(s.denizensAt('c1')).toContain(WOLVES)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(1)
        expect(s.getPlayerState(DANA).secrets).toBe(2)
    })

    it('New Growth and Crop Rotation on the card turned faceup as an adviser: accepted', () => {
        const s = facedownTable(BEFORE, [NEW_GROWTH, CROP_ROTATION])
        expect(facedownReason(s, SearchPlay.Adviser, [NEW_GROWTH_USE])).toBeUndefined()
        expect(facedownReason(s, SearchPlay.Adviser, [CROP_ROTATION_USE])).toBeUndefined()
    })

    it('Welcoming Party: refused, as the card played is a facedown adviser', () => {
        const s = facedownTable(BEFORE, [WELCOMING_PARTY])
        expect(facedownReason(s, SearchPlay.Site, [WELCOMING_USE])).toBe(WELCOMING_FACEDOWN)
    })
})

// --- False Prophet: "If it is ever discarded, kill the warband and play or discard the Vision as if you had searched." ---

/**
 * Dana's Search reveals the Vision of Conquest, so their Vision of Faith, with Rhys's warband on it (False Prophet),
 * is discarded and Rhys is asked to play or discard it. Rhys stands at the River (c2), which Mara, the Chancellor,
 * rules, with Forced Labor and Great Spire there; Rhys's 1 favor pays Forced Labor's toll.
 */
function asked(revision: OathRevision, advisers: string[] = []): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                revealedVisionId: FAITH,
                warbandsInPersonalBank: { [DANA]: 10 }
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Blue,
                siteId: 'c2',
                favor: 1,
                secrets: 2,
                supply: 5,
                advisers: [FALSE_PROPHET_ID, ...advisers].map((cardId) => ({
                    cardId,
                    faceUp: true
                })),
                warbandsInPersonalBank: { [RHYS]: 10 }
            }),
            testPlayer({
                playerId: MARA,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                favor: 2,
                secrets: 1,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 }
            })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: MARA,
            denizensBySite: { c1: [], c2: [FORCED_LABOR], p1: [], h1: [] },
            warbandsBySite: { c1: { [DANA]: 1 }, c2: { [IMPERIAL_WARBANDS]: 2 } },
            warbandsOnCards: { [FAITH]: { [RHYS]: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(s, DANA)
    s.requireVault().worldDeck = [CONQUEST, FILLER]
    s.worldDeckVisions = 1
    placeEdifice(s, 'c2', GREAT_SPIRE)
    new HydratedSearch(
        buildAction(Search, { playerId: DANA, drawFrom: SearchSource.WorldDeck, revealsInfo: true })
    ).apply(s)
    new HydratedSearchResolve(
        buildAction(SearchResolve, {
            playerId: DANA,
            keptCardId: CONQUEST,
            discardOrder: [],
            play: SearchPlay.RevealedVision
        })
    ).apply(s)
    return s
}

function answer(play: SearchPlay, modifiers: ModifierUse[] = []): QuestionAnswer {
    return {
        kind: PowerQuestionKind.PlayOrDiscardVision,
        play,
        ...(modifiers.length > 0 ? { modifiers } : {})
    }
}

const prophetReason = (s: HydratedOathGameState, play: SearchPlay, modifiers: ModifierUse[]) =>
    HydratedAnswerQuestion.reasonCannotAnswer(s, RHYS, answer(play, modifiers))

const VISION_PLAYS = [SearchPlay.RevealedVision, SearchPlay.Discard]

describe('False Prophet’s answer: a declared modifier that cannot act on it is refused (revision 33)', () => {
    it('the scene: Rhys is asked about Faith', () => {
        const s = asked(FIXED)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.PlayOrDiscardVision,
            askedPlayerId: RHYS,
            visionCardId: FAITH
        })
    })

    it.each(VISION_PLAYS)(
        'Great Spire (%s): refused, as this play draws nothing, and neither the secret nor the toll is paid',
        (play) => {
            const s = asked(FIXED)
            expect(prophetReason(s, play, [SPIRE_USE])).toBe(SPIRE_DRAWS_NOTHING)
            expect(() => answerQuestion(s, RHYS, answer(play, [SPIRE_USE]))).toThrow(
                SPIRE_DRAWS_NOTHING
            )
            expect(s.getPlayerState(RHYS).secrets).toBe(2)
            expect(s.getPlayerState(RHYS).secretsFacedown).toBe(0)
            expect(s.getPlayerState(RHYS).favor).toBe(1)
            expect(s.pendingQuestions?.queue).toHaveLength(1)
        }
    )

    it.each(VISION_PLAYS)(
        'New Growth (%s): refused, as the Vision is not played to a site',
        (play) => {
            const s = asked(FIXED, [NEW_GROWTH])
            expect(prophetReason(s, play, [NEW_GROWTH_USE])).toBe(GROWTH_VISION)
        }
    )

    it.each(VISION_PLAYS)(
        'Welcoming Party (%s): refused, as the card played is a Vision, and no facedown adviser is named',
        (play) => {
            const s = asked(FIXED, [WELCOMING_PARTY])
            const reason = prophetReason(s, play, [WELCOMING_USE])
            expect(reason).toBe(WELCOMING_VISION)
            expect(reason).not.toContain('facedown adviser')
        }
    )

    it('control: the plain discard is accepted and pays only the toll', () => {
        const s = asked(FIXED)
        expect(prophetReason(s, SearchPlay.Discard, [])).toBeUndefined()
        answerQuestion(s, RHYS, answer(SearchPlay.Discard))
        expect(s.getPlayerState(RHYS).favor).toBe(0)
        expect(s.getPlayerState(RHYS).secrets).toBe(2)
        expect(s.tokensOn(GREAT_SPIRE).secrets).toBe(0)
    })

    it('Wild Cry, which only an after-play hook carries, is accepted as before', () => {
        const s = asked(FIXED, [WILD_CRY])
        expect(prophetReason(s, SearchPlay.RevealedVision, [WILD_CRY_USE])).toBeUndefined()
    })

    it('Rhys’s own projected view gives the same answers', () => {
        const s = asked(FIXED, [NEW_GROWTH, WELCOMING_PARTY])
        const own = ownView(s, rhysView)
        expect(prophetReason(own, SearchPlay.Discard, [SPIRE_USE])).toBe(SPIRE_DRAWS_NOTHING)
        expect(prophetReason(own, SearchPlay.RevealedVision, [NEW_GROWTH_USE])).toBe(GROWTH_VISION)
        expect(prophetReason(own, SearchPlay.Discard, [WELCOMING_USE])).toBe(WELCOMING_VISION)
        expect(prophetReason(own, SearchPlay.Discard, [])).toBeUndefined()
    })
})

describe('False Prophet’s answer in a game created before revision 33 keeps what it accepted', () => {
    it.each(VISION_PLAYS)('Great Spire (%s): accepted, and its secret paid', (play) => {
        const s = asked(BEFORE)
        expect(prophetReason(s, play, [SPIRE_USE])).toBeUndefined()
        answerQuestion(s, RHYS, answer(play, [SPIRE_USE]))
        // R-7.1.2.a — out of turn, the secret goes facedown on Rhys's board.
        expect(s.getPlayerState(RHYS).secrets).toBe(1)
        expect(s.getPlayerState(RHYS).secretsFacedown).toBe(1)
    })

    it.each(VISION_PLAYS)('New Growth (%s): accepted', (play) => {
        const s = asked(BEFORE, [NEW_GROWTH])
        expect(prophetReason(s, play, [NEW_GROWTH_USE])).toBeUndefined()
    })

    it.each(VISION_PLAYS)('Welcoming Party (%s): refused, as before', (play) => {
        const s = asked(BEFORE, [WELCOMING_PARTY])
        expect(prophetReason(s, play, [WELCOMING_USE])).toBe(WELCOMING_FACEDOWN)
    })
})

import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from './playFacedownAdviser.js'
import { AnswerQuestion } from './answerQuestion.js'
import { HydratedCampaign } from './campaign.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { OathVisibility } from '../definition/runtime.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { AdviserRow } from '../model/playerState.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { bank, modifierUse, yes } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { FILLER, INN } from '../testing/cards.js'
import { playMapChanges } from '../util/cardPlay.js'
import { freeActionTypesNow } from '../util/freeActions.js'
import { searchPlayModifiers, type ModifierUse } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Law 7.3.3: "Gain favor from playing to site, resolve Homeland site powers, and resolve modifiers before
// resolving this." R-7.3.3-H3: a Search's modifiers resolve once (R-7.4.2), after the kept card's play and its
// gains, before its When Played power, reading both cards played; then the second card's play.

const WELCOMING = 'denizen.hearth.welcoming-party'
const WILD_CRY = 'denizen.beast.wild-cry'
const HUNTING_PARTY = 'denizen.order.hunting-party'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const DISSENT = 'denizen.discord.dissent'
const SALAD_DAYS = 'denizen.hearth.salad-days'
const HEIR = 'denizen.beast.long-lost-heir'
const ANIMAL_HOST = 'denizen.beast.animal-host'
const REVELATION = 'denizen.arcane.revelation'
const WOLVES = 'denizen.beast.wolves'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.Chronicle

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }

interface Table {
    revision: OathRevision
    top: string[]
    atSite?: string[]
    advisers?: AdviserRow[]
    favorBank?: Record<Suit, number>
    warbandsInBank?: number
    supply?: number
    favor?: number
}

/** Dana rules c1, where `atSite` stand (Welcoming Party alone by default); the world deck's top is `top`. */
function table({
    revision,
    top,
    atSite = [WELCOMING],
    advisers = [],
    favorBank,
    warbandsInBank = 14,
    supply = 7,
    favor = 0
}: Table): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor,
                supply,
                advisers,
                warbandsInPersonalBank: { dana: warbandsInBank }
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1', favor: 2 }),
            testPlayer({
                playerId: 'chancellor',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h3'
            })
        ],
        {
            oathRevision: revision,
            denizensBySite: { c1: atSite, c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            ...(favorBank ? { favorBank } : {})
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [...top]
    return s
}

function searchOf(modifiers: ModifierUse[]): Search {
    return buildAction(Search, {
        playerId: 'dana',
        drawFrom: SearchSource.WorldDeck,
        revealsInfo: true,
        modifiers
    })
}

function searched(t: Table, modifiers: string[] = [WELCOMING]): HydratedOathGameState {
    const s = table(t)
    new HydratedSearch(searchOf(modifiers.map((id) => modifierUse(id)))).apply(s)
    return s
}

function kept(
    cardId: string,
    choice: Partial<SearchResolveChoice> = {},
    discardOrder: string[] = [FILLER, FILLER]
): SearchResolveChoice {
    return { keptCardId: cardId, discardOrder, play: SearchPlay.Adviser, faceUp: true, ...choice }
}

function resolved(s: HydratedOathGameState, choice: SearchResolveChoice): HydratedSearchResolve {
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: 'dana', ...choice })
    )
    action.apply(s)
    return action
}

const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

const SALAD_BANKS: Record<Suit, number> = {
    [Suit.Arcane]: 0,
    [Suit.Beast]: 3,
    [Suit.Discord]: 0,
    [Suit.Hearth]: 1,
    [Suit.Nomad]: 0,
    [Suit.Order]: 3
}
const SALAD_PICKS = [bank(Suit.Beast), bank(Suit.Order), bank(Suit.Arcane)]

describe('Welcoming Party pays before the kept card’s When Played power (from revision 31)', () => {
    it('Dissent takes the favor Welcoming Party gave Dana', () => {
        const s = searched({ revision: FIXED, top: [DISSENT, FILLER, FILLER] })
        const action = resolved(s, kept(DISSENT))
        expect(s.tokensOn(DISSENT).favor).toBe(1)
        expect(s.getPlayerState('dana').favor).toBe(0)
        expect(action.metadata?.modifierNotes).toEqual([
            'Welcoming Party: gained 1 favor from the hearth bank'
        ])
        expect(action.metadata?.whenPlayed).toBe(
            'Dissent: 1 favor placed on it, one per suit each player rules'
        )
    })

    it('before revision 31, Dissent resolves first and takes nothing; Dana keeps the favor', () => {
        const s = searched({ revision: BEFORE, top: [DISSENT, FILLER, FILLER] })
        const action = resolved(s, kept(DISSENT))
        expect(s.tokensOn(DISSENT).favor).toBe(0)
        expect(s.getPlayerState('dana').favor).toBe(1)
        expect(action.metadata?.whenPlayed).toBe(
            'Dissent: 0 favor placed on it, one per suit each player rules'
        )
    })

    it('Salad Days is judged on the banks after Welcoming Party took the hearth bank’s last favor', () => {
        const s = searched({
            revision: FIXED,
            top: [SALAD_DAYS, FILLER, FILLER],
            favorBank: SALAD_BANKS
        })
        const choice = kept(SALAD_DAYS, { choices: SALAD_PICKS })
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)).toBeUndefined()
        resolved(s, choice)
        expect(s.getPlayerState('dana').favor).toBe(3)
        expect(s.favorBank[Suit.Hearth]).toBe(0)
    })

    it('before revision 31, the same picks are refused: the hearth bank still holds its favor', () => {
        const s = searched({
            revision: BEFORE,
            top: [SALAD_DAYS, FILLER, FILLER],
            favorBank: SALAD_BANKS
        })
        expect(
            HydratedSearchResolve.reasonCannotResolve(
                s,
                'dana',
                kept(SALAD_DAYS, { choices: SALAD_PICKS })
            )
        ).toMatch(/the banks named yield 2, and 3 can be had/)
    })

    it('the banks the When Played picks are shown on hold Welcoming Party’s favor taken, from revision 31 only', () => {
        const banksFor = (revision: OathRevision) => {
            const s = searched({
                revision,
                top: [SALAD_DAYS, FILLER, FILLER],
                favorBank: SALAD_BANKS
            })
            return playMapChanges(s, 'dana', SALAD_DAYS, SearchPlay.Adviser, {
                faceUp: true,
                carried: searchPlayModifiers(s)
            }).gains?.favorBank
        }
        expect(banksFor(FIXED)?.[Suit.Hearth]).toBe(0)
        expect(banksFor(BEFORE)?.[Suit.Hearth]).toBe(1)
    })

    it('a site play: the gain shown is still one favor each from the site and Welcoming Party, and the banks hold both taken', () => {
        const s = searched({ revision: FIXED, top: [WOLVES, FILLER, FILLER] })
        const changes = playMapChanges(s, 'dana', WOLVES, SearchPlay.Site, {
            carried: searchPlayModifiers(s)
        })
        expect(changes.gains?.favorTaken).toEqual([{ suit: Suit.Beast, gained: 1 }])
        expect(changes.gains?.favorAfter).toBe(1)
        expect(changes.gains?.favorBank[Suit.Hearth]).toBe(2)
    })

    it('a facedown adviser kept shows no card: Welcoming Party pays nothing and the banks are unchanged', () => {
        const s = searched({ revision: FIXED, top: [DISSENT, FILLER, FILLER] })
        const changes = playMapChanges(s, 'dana', DISSENT, SearchPlay.Adviser, {
            faceUp: false,
            carried: searchPlayModifiers(s)
        })
        expect(changes.gains?.favorBank[Suit.Hearth]).toBe(3)
        const action = resolved(s, kept(DISSENT, { faceUp: false }))
        expect(action.metadata?.modifierNotes).toBeUndefined()
        expect(s.favorBank[Suit.Hearth]).toBe(3)
    })

    it("on Dana's own view: Salad Days is accepted, the banks shown hold the favor taken, and the state is neither copied nor changed", () => {
        const s = searched({
            revision: FIXED,
            top: [SALAD_DAYS, FILLER, FILLER],
            favorBank: SALAD_BANKS
        })
        const server = JSON.stringify(s.dehydrate())
        const own = ownView(s)
        expect(
            HydratedSearchResolve.reasonCannotResolve(
                own,
                'dana',
                kept(SALAD_DAYS, { choices: SALAD_PICKS })
            )
        ).toBeUndefined()
        expect(
            playMapChanges(own, 'dana', SALAD_DAYS, SearchPlay.Adviser, {
                faceUp: true,
                carried: searchPlayModifiers(own)
            }).gains?.favorBank[Suit.Hearth]
        ).toBe(0)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })
})

describe('Wild Cry pays before the kept card’s When Played power (from revision 31)', () => {
    const heirTable = (revision: OathRevision): Table => ({
        revision,
        top: [HEIR, FILLER, FILLER],
        atSite: [WILD_CRY],
        supply: 4
    })

    it('Long-Lost Heir: Wild Cry’s warbands are Dana’s when they become a Citizen, and the Supply refreshes after', () => {
        const s = searched(heirTable(FIXED), [WILD_CRY])
        const action = resolved(s, kept(HEIR, { choices: [yes] }))
        expect(action.metadata?.modifierNotes).toEqual(['Wild Cry: gained 1 Supply and 2 warbands'])
        expect(action.metadata?.whenPlayed).toMatch(
            /^Long-Lost Heir: became a Citizen \(3 warbands became Imperial\)/
        )
        expect(s.getPlayerState('dana').status).toBe(PlayerStatus.Citizen)
        expect(s.getPlayerState('dana').supply).toBe(7)
    })

    it('before revision 31, the Heir resolves first: Wild Cry’s warbands come as a Citizen’s, after the refresh', () => {
        const s = searched(heirTable(BEFORE), [WILD_CRY])
        const action = resolved(s, kept(HEIR, { choices: [yes] }))
        expect(action.metadata?.whenPlayed).toMatch(
            /^Long-Lost Heir: became a Citizen \(1 warbands became Imperial\)/
        )
        expect(action.metadata?.modifierNotes).toEqual([
            'Wild Cry: gained 0 Supply and 2 Imperial warbands'
        ])
    })

    const hostTable = (revision: OathRevision): Table => ({
        revision,
        top: [ANIMAL_HOST, FILLER, FILLER],
        atSite: [WILD_CRY],
        warbandsInBank: 3
    })

    it('Animal Host: Wild Cry takes its two warbands from Dana’s bank first, and Animal Host the one left', () => {
        const s = searched(hostTable(FIXED), [WILD_CRY])
        const action = resolved(s, kept(ANIMAL_HOST, { play: SearchPlay.Site, faceUp: undefined }))
        expect(action.metadata?.modifierNotes).toEqual(['Wild Cry: gained 1 Supply and 2 warbands'])
        expect(action.metadata?.whenPlayed).toBe('gained 1 warband (2 beast cards at sites)')
    })

    it('before revision 31, Animal Host takes two first and Wild Cry the one left', () => {
        const s = searched(hostTable(BEFORE), [WILD_CRY])
        const action = resolved(s, kept(ANIMAL_HOST, { play: SearchPlay.Site, faceUp: undefined }))
        expect(action.metadata?.whenPlayed).toBe('gained 2 warbands (2 beast cards at sites)')
        expect(action.metadata?.modifierNotes).toEqual(['Wild Cry: gained 1 Supply and 1 warband'])
    })
})

describe('Land Warden: the modifiers read both cards, pay once, and pay before the kept card’s power', () => {
    const wardenTable = (revision: OathRevision): Table => ({
        revision,
        top: [DISSENT, WOLVES, FILLER],
        atSite: [WELCOMING, WILD_CRY],
        advisers: [{ cardId: LAND_WARDEN, faceUp: true }],
        favor: 1
    })
    const dissentThenWolves = kept(
        DISSENT,
        { secondPlay: { cardId: WOLVES, play: SearchPlay.Site } },
        [FILLER]
    )
    const modifiers = [LAND_WARDEN, WELCOMING, WILD_CRY]

    it('Dissent kept, the Wolves second: Welcoming Party and Wild Cry pay once each, and Dissent takes the favor', () => {
        const s = searched(wardenTable(FIXED), modifiers)
        const action = resolved(s, dissentThenWolves)
        expect(action.metadata?.modifierNotes).toEqual([
            'Welcoming Party: gained 1 favor from the hearth bank',
            'Wild Cry: gained 1 Supply and 2 warbands'
        ])
        expect(s.tokensOn(DISSENT).favor).toBe(1)
        expect(s.getPlayerState('dana').favor).toBe(1)
        expect(s.denizensAt('c1')).toContain(WOLVES)
    })

    it('before revision 31, Dissent resolves before either modifier and takes nothing', () => {
        const s = searched(wardenTable(BEFORE), modifiers)
        const action = resolved(s, dissentThenWolves)
        expect(action.metadata?.modifierNotes).toEqual([
            'Welcoming Party: gained 1 favor from the hearth bank',
            'Wild Cry: gained 1 Supply and 2 warbands'
        ])
        expect(s.tokensOn(DISSENT).favor).toBe(0)
        expect(s.getPlayerState('dana').favor).toBe(2)
    })

    const innTable = (revision: OathRevision): Table => ({
        revision,
        top: [DISSENT, INN, FILLER],
        advisers: [{ cardId: LAND_WARDEN, faceUp: true }],
        favor: 1,
        favorBank: { ...SALAD_BANKS, [Suit.Hearth]: 1 }
    })
    const facedownThenInn = kept(
        DISSENT,
        { faceUp: false, secondPlay: { cardId: INN, play: SearchPlay.Site } },
        [FILLER]
    )

    it('a facedown adviser kept and the Inn second: Welcoming Party reads the Inn and takes the hearth favor before the Inn is played', () => {
        const s = searched(innTable(FIXED), [LAND_WARDEN, WELCOMING])
        const action = resolved(s, facedownThenInn)
        expect(action.metadata?.modifierNotes).toEqual([
            'Welcoming Party: gained 1 favor from the hearth bank'
        ])
        expect(action.metadata?.favorShort).toEqual([{ suit: Suit.Hearth, ranOut: false }])
        expect(s.getPlayerState('dana').favor).toBe(1)
    })

    it('before revision 31, the Inn takes the hearth favor and Welcoming Party finds none', () => {
        const s = searched(innTable(BEFORE), [LAND_WARDEN, WELCOMING])
        const action = resolved(s, facedownThenInn)
        expect(action.metadata?.modifierNotes).toEqual([
            'Welcoming Party: gained 0 favor from the hearth bank'
        ])
        expect(action.metadata?.favorShort).toBeUndefined()
        expect(s.getPlayerState('dana').favor).toBe(1)
    })
})

describe('Hunting Party with a kept card whose When Played power asks questions', () => {
    function throughTheQuestions(revision: OathRevision) {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table({
            revision,
            top: [REVELATION, FILLER, FILLER],
            atSite: [WELCOMING, HUNTING_PARTY]
        }).dehydrate()
        state = engine.runNext(
            searchOf([modifierUse(HUNTING_PARTY), modifierUse(WELCOMING)]),
            state,
            game
        ).updatedState
        state = engine.runNext(
            buildAction(SearchResolve, { playerId: 'dana', ...kept(REVELATION) }),
            state,
            game
        ).updatedState
        const asked = state.pendingQuestions?.queue.map((q) => q.askedPlayerId)
        while (state.machineState === MachineState.PowerQuestion) {
            const playerId = state.activePlayerIds[0]
            state = engine.runNext(
                buildAction(AnswerQuestion, {
                    playerId,
                    answer: { kind: PowerQuestionKind.BurnFavorForSecrets, favor: 0 }
                }),
                state,
                game
            ).updatedState
        }
        return { asked, state, game }
    }

    it('from revision 31: Welcoming Party’s favor makes Dana one of those asked, and the free Campaign is due after the answers', () => {
        const { asked, state, game } = throughTheQuestions(FIXED)
        expect(asked).toEqual(['dana', 'rhys'])
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(engine.getValidActionTypesForPlayer(game, state, 'dana')).toContain(
            ActionType.ForgoFreeAction
        )
        const after = new HydratedOathGameState(state)
        expect(freeActionTypesNow(after, 'dana')).toEqual([ActionType.Campaign])
        expect(HydratedCampaign.supplyCostFor(after, 'dana')).toBe(0)
    })

    it('before revision 31: Dana has no favor when Revelation asks, and the free Campaign is due as well', () => {
        const { asked, state } = throughTheQuestions(BEFORE)
        expect(asked).toEqual(['rhys'])
        const after = new HydratedOathGameState(state)
        expect(freeActionTypesNow(after, 'dana')).toEqual([ActionType.Campaign])
        expect(HydratedCampaign.supplyCostFor(after, 'dana')).toBe(0)
    })
})

describe('R-6.1: a facedown adviser played faceup resolves its modifiers before its When Played power', () => {
    function flipTable(revision: OathRevision): HydratedOathGameState {
        return table({
            revision,
            top: [],
            atSite: [WELCOMING, WILD_CRY],
            advisers: [{ cardId: HEIR, faceUp: false }],
            supply: 4
        })
    }
    const flip = (modifiers: string[]) =>
        new HydratedPlayFacedownAdviser(
            buildAction(PlayFacedownAdviser, {
                playerId: 'dana',
                cardId: HEIR,
                play: SearchPlay.Adviser,
                choices: [yes],
                modifiers: modifiers.map((id) => modifierUse(id))
            })
        )

    it('Welcoming Party is still refused: its text excludes a facedown adviser', () => {
        const s = flipTable(FIXED)
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, 'dana', {
                cardId: HEIR,
                play: SearchPlay.Adviser,
                choices: [yes],
                modifiers: [modifierUse(WELCOMING)]
            })
        ).toMatch(/facedown adviser/)
    })

    it('Long-Lost Heir with Wild Cry: Wild Cry’s warbands are Dana’s when they become a Citizen', () => {
        const s = flipTable(FIXED)
        const action = flip([WILD_CRY])
        action.apply(s)
        expect(action.metadata?.modifierNotes).toEqual(['Wild Cry: gained 1 Supply and 2 warbands'])
        expect(action.metadata?.whenPlayed).toMatch(
            /^Long-Lost Heir: became a Citizen \(3 warbands became Imperial\)/
        )
        expect(s.getPlayerState('dana').supply).toBe(7)
    })

    it('before revision 31, the Heir resolves first and Wild Cry pays a Citizen', () => {
        const s = flipTable(BEFORE)
        const action = flip([WILD_CRY])
        action.apply(s)
        expect(action.metadata?.whenPlayed).toMatch(
            /^Long-Lost Heir: became a Citizen \(1 warbands became Imperial\)/
        )
        expect(action.metadata?.modifierNotes).toEqual([
            'Wild Cry: gained 0 Supply and 2 Imperial warbands'
        ])
    })
})

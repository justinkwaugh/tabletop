import { describe, expect, it } from 'vitest'
import { machineContext, buildAction } from '../testing/actions.js'
import { Color } from '@tabletop/common'
import { HydratedUseRestPower, UseRestPower } from '../actions/useRestPower.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { HydratedCompleteRest, CompleteRest } from '../actions/completeRest.js'
import { HydratedTrade, TradeOption } from '../actions/trade.js'
import { SearchPlay } from '../actions/searchResolve.js'
import { reasonCannotPlayCard } from '../util/cardPlay.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { RestPhaseStateHandler } from '../stateHandlers/restPhase.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { effectiveAdviserLimit } from '../util/continuous.js'
import '../powers/index.js'
import { bank } from '../testing/choices.js'
import { INN } from '../testing/cards.js'

const POVERTY = 'denizen.beast.vow-of-poverty'
const OBEDIENCE = 'denizen.order.vow-of-obedience'
const INSOMNIA = 'denizen.discord.insomnia'
const SILVER = 'denizen.discord.silver-tongue'
const ASSASSIN = 'denizen.discord.assassin'
const NAYSAYERS = 'denizen.discord.naysayers'
const OAK = 'denizen.beast.the-old-oak'
const TENTS = 'denizen.nomad.tents'
const RETURN = 'denizen.hearth.awaited-return'

function rest(cardId: string, choices?: PowerChoice[], playerId = 'ruler') {
    return new HydratedUseRestPower(
        buildAction(UseRestPower, { playerId, cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Rest), choices })
    )
}

function board(cards: string[], advisers: string[] = [], ruler: Record<string, unknown> = {}, over: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: 'ruler',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 3,
                warbandsOnBoard: { ruler: 2 },
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true })),
                ...ruler
            }),
            testPlayer({
                playerId: 'chancellor',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 4
            })
        ],
        {
            chancellorPlayerId: 'chancellor',
            denizensBySite: { c1: cards, c2: [], h1: [] },
            warbandsBySite: { c1: { ruler: 1 } },
            siteCards: { c1: 'site.mine', c2: 'site.river', h1: 'site.wastes' },
            ...over
        }
    )
    openTurn(s, 'ruler')
    s.turnManager.turnOrder = ['ruler', 'chancellor']
    return s
}

describe('Rest powers — R-4.3.5, R-7.3.4', () => {
    it('Insomnia: gains a secret, once each per Rest, and the ledger clears when the turn closes', () => {
        const s = board([], [INSOMNIA])
        const action = rest(INSOMNIA)
        action.apply(s)
        expect(s.getPlayerState('ruler').secrets).toBe(3)
        expect(action.metadata?.summary).toMatch(/Insomnia/)
        expect(() => rest(INSOMNIA).apply(s)).toThrow(/once each/)
        expect(HydratedUseRestPower.legalRestPowers(s, 'ruler')).toEqual([])

        const handler = new RestPhaseStateHandler()
        expect(handler.onAction(action, machineContext(s))).toBe(MachineState.RestPhase)

        new HydratedCompleteRest(buildAction(CompleteRest, { playerId: 'ruler' })).apply(s)
        expect(s.getPlayerState('ruler').restPowersUsedThisTurn).toEqual([])
    })

    it('is offered by the Rest Phase only while something is usable', () => {
        const handler = new RestPhaseStateHandler()
        const s = board([], [INSOMNIA])
        expect(handler.validActionsForPlayer('ruler', machineContext(s))).toEqual([
            ActionType.UseRestPower,
            ActionType.CompleteRest
        ])
        expect(handler.validActionsForPlayer('chancellor', machineContext(s))).toEqual([])
        expect(handler.validActionsForPlayer('ruler', machineContext(board([])))).toEqual([
            ActionType.CompleteRest
        ])
    })

    it('refuses a Rest power out of turn, and through UseActionPower', () => {
        const s = board([], [INSOMNIA])
        expect(() => rest(INSOMNIA, undefined, 'chancellor').apply(s)).toThrow(/not your turn/)
        const use = new HydratedUseActionPower(
            buildAction(UseActionPower, { playerId: 'ruler', cardId: INSOMNIA, powerIndex: powerIndexOf(INSOMNIA, PowerTiming.Rest) })
        )
        expect(() => use.apply(s)).toThrow(/"Action:"/)
    })

    it('Vow of Poverty: only with no favor, two from the chosen bank', () => {
        const s = board([], [POVERTY])
        expect(() => rest(POVERTY, [bank(Suit.Hearth)]).apply(s)).toThrow(/you have favor/)
        const poor = board([], [POVERTY], { favor: 0 })
        const before = poor.favorBank[Suit.Hearth]
        rest(POVERTY, [bank(Suit.Hearth)]).apply(poor)
        expect(poor.getPlayerState('ruler').favor).toBe(2)
        expect(poor.favorBank[Suit.Hearth]).toBe(before - 2)
        expect(() => rest(POVERTY).apply(board([], [POVERTY], { favor: 0 }))).toThrow(/favor bank/)
    })

    it('Vow of Obedience: one favor from any bank', () => {
        const s = board([], [OBEDIENCE])
        rest(OBEDIENCE, [bank(Suit.Arcane)]).apply(s)
        expect(s.getPlayerState('ruler').favor).toBe(4)
    })

    it('Silver Tongue: the bank must match a card at your site', () => {
        const s = board([INN, OAK], [SILVER])
        const legal = HydratedUseRestPower.legalRestPowers(s, 'ruler')
        expect(legal[0]?.choices[0]?.options.map((o) => (o.kind === PowerChoiceKind.FavorBank ? o.suit : undefined)).sort()).toEqual(
            [Suit.Beast, Suit.Hearth].sort()
        )
        expect(() => rest(SILVER, [bank(Suit.Arcane)]).apply(board([INN, OAK], [SILVER]))).toThrow()
        rest(SILVER, [bank(Suit.Beast)]).apply(s)
        expect(s.getPlayerState('ruler').favor).toBe(4)
    })

    it('Naysayers: takes from the Chancellor only while an Exile holds the title', () => {
        const none = board([], [NAYSAYERS], {}, { oathkeeperPlayerId: 'chancellor' })
        expect(() => rest(NAYSAYERS).apply(none)).toThrow(/no Exile holds/)
        const s = board([], [NAYSAYERS], {}, { oathkeeperPlayerId: 'ruler' })
        rest(NAYSAYERS).apply(s)
        expect(s.getPlayerState('ruler').favor).toBe(4)
        expect(s.getPlayerState('chancellor').favor).toBe(3)
    })
})

describe('continuous powers — R-7.1.4-H1', () => {
    it('adviser limiters cap at two, the lowest among them, not additively (R-7.6.4)', () => {
        expect(effectiveAdviserLimit(board([], []), 'ruler')).toBe(3)
        expect(effectiveAdviserLimit(board([], [INSOMNIA]), 'ruler')).toBe(2)
        expect(effectiveAdviserLimit(board([], [INSOMNIA, ASSASSIN]), 'ruler')).toBe(2)
        // R-7.2 — a facedown limiter has no power.
        const down = board([], [], { advisers: [{ cardId: INSOMNIA, faceUp: false }] })
        expect(effectiveAdviserLimit(down, 'ruler')).toBe(3)
    })

    it('a third adviser is refused with a limiter held; playing the limiter third forces the discard', () => {
        const s = board([], [INSOMNIA, TENTS])
        s.getPlayerState('ruler').handIds = [RETURN]
        expect(reasonCannotPlayCard(s, 'ruler', RETURN, SearchPlay.Adviser, { faceUp: true })).toMatch(/adviser limit of 2/)

        const t = board([], [RETURN, TENTS])
        t.getPlayerState('ruler').handIds = [SILVER]
        expect(reasonCannotPlayCard(t, 'ruler', SILVER, SearchPlay.Adviser, { faceUp: true })).toMatch(/adviser limit of 2/)
        expect(
            reasonCannotPlayCard(t, 'ruler', SILVER, SearchPlay.Adviser, { faceUp: true, discardedAdviserCardIds: [RETURN] })
        ).toBeUndefined()
        expect(reasonCannotPlayCard(t, 'ruler', SILVER, SearchPlay.Adviser, { faceUp: false })).toBeUndefined()
    })

    it('R-7.6.4 — a limiter played over three advisers discards two; turned faceup from three, it discards one (R-6.1)', () => {
        const t = board([], [RETURN, TENTS, INN])
        t.getPlayerState('ruler').handIds = [SILVER]
        expect(reasonCannotPlayCard(t, 'ruler', SILVER, SearchPlay.Adviser, { faceUp: true, discardedAdviserCardIds: [RETURN] })).toMatch(/2 advisers must be discarded/)
        expect(reasonCannotPlayCard(t, 'ruler', SILVER, SearchPlay.Adviser, { faceUp: true, discardedAdviserCardIds: [RETURN, RETURN] })).toMatch(/discarded once/)
        expect(reasonCannotPlayCard(t, 'ruler', SILVER, SearchPlay.Adviser, { faceUp: true, discardedAdviserCardIds: [RETURN, TENTS] })).toBeUndefined()

        const flip = board([], [RETURN, TENTS], { advisers: [{ cardId: RETURN, faceUp: true }, { cardId: TENTS, faceUp: true }, { cardId: SILVER, faceUp: false }] })
        const turnUp = (discardedAdviserCardIds?: string[]) =>
            HydratedPlayFacedownAdviser.reasonCannotPlay(flip, 'ruler', { cardId: SILVER, play: SearchPlay.Adviser, discardedAdviserCardIds })
        expect(turnUp()).toMatch(/adviser limit of 2/)
        expect(turnUp([SILVER])).toMatch(/not one of your other advisers/)
        expect(turnUp([TENTS])).toBeUndefined()
        new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, { playerId: 'ruler', cardId: SILVER, play: SearchPlay.Adviser, discardedAdviserCardIds: [TENTS] })).apply(flip)
        expect(flip.getPlayerState('ruler').knownAdvisers().map((a) => a.cardId)).toEqual([RETURN, SILVER])
    })

    it('Vow of Poverty: trading for favor is refused, trading for secrets is not', () => {
        const s = board([INN], [POVERTY])
        expect(HydratedTrade.reasonCannotTrade(s, 'ruler', INN, TradeOption.ForFavor)).toMatch(/cannot gain favor from Trade/)
        expect(HydratedTrade.reasonCannotTrade(s, 'ruler', INN, TradeOption.ForSecrets)).toBeUndefined()
        expect(HydratedTrade.reasonCannotTrade(board([INN]), 'ruler', INN, TradeOption.ForFavor)).toBeUndefined()
    })

    it('Vow of Obedience: a Vision cannot be played faceup', () => {
        const s = board([], [OBEDIENCE])
        s.getPlayerState('ruler').handIds = ['vision.conquest']
        expect(reasonCannotPlayCard(s, 'ruler', 'vision.conquest', SearchPlay.RevealedVision)).toMatch(/Vow of Obedience/)
        const free = board([], [])
        free.getPlayerState('ruler').handIds = ['vision.conquest']
        expect(reasonCannotPlayCard(free, 'ruler', 'vision.conquest', SearchPlay.RevealedVision)).toBeUndefined()
        expect(reasonCannotPlayCard(s, 'ruler', 'vision.conquest', SearchPlay.Adviser, { faceUp: false })).toBeUndefined()
    })
})

import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { HydratedTrade, Trade, TradeOption } from '../actions/trade.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { adviser } from '../testing/tables.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse, player } from '../testing/choices.js'
import { INN, TENTS } from '../testing/cards.js'
import { served } from '../testing/projection.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathVisibility } from '../definition/runtime.js'
import { OathRevision } from '../util/revision.js'
import type { ModifierUse } from '../util/modifiers.js'
import '../powers/index.js'

const CUP = 'relic.cup-of-plenty'
const MASTER = 'denizen.arcane.master-of-disguise'
const SIGNAL = 'denizen.arcane.secret-signal'
const BINDERS = 'denizen.hearth.book-binders'

const AT = OathRevision.EngineFixes19
const BEFORE = OathRevision.EngineFixes18

type Seat = Parameters<typeof testPlayer>[0]

interface Scene {
    dana?: Seat
    ann?: Seat
    revision?: number
}

/**
 * Dana stands at c1, the Wayside Inn's site (a Hearth card), with Master of Disguise and no Hearth
 * adviser, holding Cup of Plenty, with 4 Supply. Ann holds Book Binders (a Hearth adviser) faceup and
 * a facedown adviser; Bea holds no faceup adviser.
 */
function scene({ dana, ann, revision = AT }: Scene = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                supply: 4,
                favor: 2,
                secrets: 2,
                relicIds: [CUP],
                warbandsOnBoard: { dana: 3 },
                advisers: [adviser(MASTER)],
                ...dana
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                advisers: [adviser(BINDERS), adviser(TENTS, false)],
                ...ann
            }),
            testPlayer({ playerId: 'bea', color: Color.Yellow, siteId: 'h2', warbandsOnBoard: { bea: 2 } })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: 'ann',
            denizensBySite: { c1: [INN], c2: [], p1: [], h1: [] }
        }
    )
    openTurn(s, 'dana')
    return s
}
type Board = ReturnType<typeof scene>

const disguisedAs = (playerId: string, ...more: ModifierUse[]) => [modifierUse(MASTER, [player(playerId)]), ...more]
const withCup = (playerId = 'ann') => disguisedAs(playerId, modifierUse(CUP))
const ownBorrower: Scene = { dana: { advisers: [adviser(BINDERS), adviser(MASTER)] }, ann: { advisers: [adviser(SIGNAL)] } }

const reason = (s: Board, modifiers: ModifierUse[] = withCup()) =>
    HydratedTrade.reasonCannotTrade(s, 'dana', INN, TradeOption.ForFavor, modifiers)

function trade(s: Board, modifiers: ModifierUse[] = withCup()) {
    const action = new HydratedTrade(buildAction(Trade, { playerId: 'dana', cardId: INN, option: TradeOption.ForFavor, modifiers }))
    action.apply(s)
    return action
}

describe('Cup of Plenty reads the advisers Master of Disguise lends ("you fully replace your advisers")', () => {
    it('the lender has a Hearth adviser and the borrower none: no Supply is spent', () => {
        const s = scene()
        expect(reason(s)).toBeUndefined()
        const a = trade(s)
        // Ann's Book Binders matches the Wayside Inn, so the Cup waives the Trade's Supply.
        expect(a.metadata?.matchingAdvisers).toBe(1)
        expect(a.metadata?.supplySpent).toBe(0)
        expect(s.getPlayerState('dana').supply).toBe(4)
    })

    it('the borrower has a Hearth adviser and the lender none: refused', () => {
        const s = scene(ownBorrower)
        expect(reason(s)).toMatch(/matches none of your advisers/)
        // Without the disguise the borrower's own Book Binders counts, as ever.
        expect(reason(s, [modifierUse(CUP)])).toBeUndefined()
    })

    it('a lender’s facedown adviser has no suit, and a lender with no faceup adviser lends no match', () => {
        const facedown = scene({ ann: { advisers: [adviser(BINDERS, false)] } })
        expect(reason(facedown)).toMatch(/matches none of your advisers/)
        expect(reason(scene(), withCup('bea'))).toMatch(/matches none of your advisers/)
    })
})

describe('R-X.4 — before revision 23 Cup of Plenty reads the borrower’s own advisers', () => {
    it('the lender’s Hearth adviser does not count, and the borrower’s does', () => {
        expect(reason(scene({ revision: BEFORE }))).toMatch(/matches none of your advisers/)
        const own = scene({ ...ownBorrower, revision: BEFORE })
        expect(reason(own)).toBeUndefined()
        const a = trade(own)
        // Ann lends no Hearth adviser, so nothing matches, yet the Cup waives the Supply.
        expect(a.metadata?.matchingAdvisers).toBe(0)
        expect(a.metadata?.supplySpent).toBe(0)
    })

    it('each revision’s disguised Trade replays unchanged', () => {
        // Before 23 only the borrower's own Hearth adviser opens the Cup; from 23 only the lender's.
        const cases: [number, Scene][] = [
            [BEFORE, ownBorrower],
            [AT, {}]
        ]
        for (const [revision, over] of cases) {
            const before = scene({ ...over, revision }).dehydrate()
            const game = testGame(['dana', 'ann', 'bea'])
            const action = buildAction(Trade, { playerId: 'dana', cardId: INN, option: TradeOption.ForFavor, modifiers: withCup() })
            const recorded = engine.runNext(action, structuredClone(before), game)
            expect(recorded.updatedState.players.find((p) => p.playerId === 'dana')?.supply).toBe(4)

            let replayed = structuredClone(before)
            for (const processed of recorded.processedActions)
                replayed = engine.run(structuredClone(processed), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        }
    })
})

describe('Cup of Plenty and Master of Disguise on the borrower’s own view', () => {
    it('the Trade’s plan reads the same as on the whole state', () => {
        const view: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
        const scenes = [
            scene(),
            scene({ dana: ownBorrower.dana, ann: { advisers: [adviser(SIGNAL), adviser(TENTS, false)] } }),
            scene({ ann: { advisers: [adviser(BINDERS, false)] } })
        ]
        for (const s of scenes) {
            const own = OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)
            for (const modifiers of [withCup(), withCup('bea'), [modifierUse(CUP)]]) {
                const whole = HydratedTrade.plan(s, 'dana', INN, TradeOption.ForFavor, modifiers)
                const seen = HydratedTrade.plan(own, 'dana', INN, TradeOption.ForFavor, modifiers)
                expect(seen.reason).toEqual(whole.reason)
                expect(seen.cost).toEqual(whole.cost)
            }
        }
    })
})

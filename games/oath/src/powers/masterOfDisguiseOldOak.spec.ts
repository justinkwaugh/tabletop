import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { HydratedTrade, Trade, TradeOption } from '../actions/trade.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { adviser } from '../testing/tables.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse, player, site } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathVisibility } from '../definition/runtime.js'
import { reliquarySlotId } from '../util/setup.js'
import { OathRevision } from '../util/revision.js'
import type { ModifierUse } from '../util/modifiers.js'
import '../powers/index.js'

const OAK = 'denizen.beast.the-old-oak'
const MASTER = 'denizen.arcane.master-of-disguise'
const SIGNAL = 'denizen.arcane.secret-signal'
const BIRDSONG = 'denizen.beast.birdsong'
const SMALL_FRIENDS = 'denizen.beast.small-friends'
const TENTS = 'denizen.nomad.tents'

const AT = OathRevision.EngineFixes19
const BEFORE = OathRevision.EngineFixes18

type Seat = Parameters<typeof testPlayer>[0]

interface Scene {
    dana?: Seat
    ann?: Seat
    /** Dana is the Chancellor, with Careless uncovered (R-6.6.2.a). */
    careless?: boolean
    revision?: number
}

/**
 * Dana stands at c1, The Old Oak's site, with Master of Disguise and no Beast adviser, and 2 favor
 * to place. Ann holds Birdsong (a Beast adviser) faceup and a facedown adviser; Bea holds no faceup
 * adviser.
 */
function scene({ dana, ann, careless = false, revision = AT }: Scene = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                status: careless ? PlayerStatus.Chancellor : PlayerStatus.Exile,
                siteId: 'c1',
                supply: 4,
                favor: 2,
                secrets: 2,
                warbandsOnBoard: careless ? { [IMPERIAL_WARBANDS]: 3 } : { dana: 3 },
                advisers: [adviser(MASTER)],
                ...dana
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: careless ? PlayerStatus.Exile : PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 2,
                secrets: 1,
                warbandsOnBoard: careless ? { ann: 2 } : { [IMPERIAL_WARBANDS]: 2 },
                advisers: [adviser(BIRDSONG), adviser(TENTS, false)],
                ...ann
            }),
            testPlayer({ playerId: 'bea', color: Color.Yellow, siteId: 'h2', warbandsOnBoard: { bea: 2 } })
        ],
        {
            oathRevision: revision,
            chancellorPlayerId: careless ? 'dana' : 'ann',
            ...(careless ? { reliquary: [0, 1, 3].map((i) => ({ slotId: reliquarySlotId(i) })) } : {}),
            denizensBySite: { c1: [OAK], c2: [], p1: [], h1: [] }
        }
    )
    openTurn(s, 'dana')
    return s
}
type Board = ReturnType<typeof scene>

const disguisedAs = (playerId: string, ...more: ModifierUse[]) => [modifierUse(MASTER, [player(playerId)]), ...more]
const withOak = (playerId = 'ann') => disguisedAs(playerId, modifierUse(OAK))

const reason = (s: Board, modifiers: ModifierUse[] = withOak()) =>
    HydratedTrade.reasonCannotTrade(s, 'dana', OAK, TradeOption.ForSecrets, modifiers)

function trade(s: Board, modifiers: ModifierUse[] = withOak()) {
    const action = new HydratedTrade(buildAction(Trade, { playerId: 'dana', cardId: OAK, option: TradeOption.ForSecrets, modifiers }))
    action.apply(s)
    return action
}

describe('The Old Oak counts the advisers Master of Disguise lends ("you fully replace your advisers")', () => {
    it('the lender has a Beast adviser and the borrower none: one more secret', () => {
        const s = scene()
        const a = trade(s)
        // Ann's Birdsong is the one matching adviser, and The Old Oak adds one.
        expect(a.metadata?.matchingAdvisers).toBe(1)
        expect(a.metadata?.secretsGained).toBe(2)
        expect(s.getPlayerState('dana').secrets).toBe(2 - 1 + 2)
    })

    it('the borrower has a Beast adviser and the lender none: refused', () => {
        const s = scene({ dana: { advisers: [adviser(BIRDSONG), adviser(MASTER)] }, ann: { advisers: [adviser(SIGNAL)] } })
        expect(reason(s)).toMatch(/you have no beast adviser/)
        // Without the disguise the borrower's own Birdsong counts, as ever.
        expect(reason(s, [modifierUse(OAK)])).toBeUndefined()
    })

    it('a lender’s facedown adviser has no suit, and a lender with no faceup adviser lends no Beast', () => {
        const facedown = scene({ ann: { advisers: [adviser(BIRDSONG, false)] } })
        expect(reason(facedown)).toMatch(/you have no beast adviser/)
        expect(reason(scene(), withOak('bea'))).toMatch(/you have no beast adviser/)
    })

    it('Careless folds with its one more: the lent Beast adviser’s secret, plus one, less one', () => {
        const s = scene({ careless: true })
        const a = trade(s)
        expect(a.metadata?.secretsGained).toBe(1)
        expect(a.metadata?.modifierNotes).toEqual(['Careless: gained 1 favor'])
    })

    it('a borrowed Small Friends names The Old Oak’s site and is the Beast adviser it counts', () => {
        const s = scene({ dana: { siteId: 'c2' }, ann: { advisers: [adviser(SMALL_FRIENDS)] } })
        const modifiers = disguisedAs('ann', modifierUse(SMALL_FRIENDS, [site('c1')]), modifierUse(OAK))
        expect(reason(s, modifiers)).toBeUndefined()
        expect(trade(s, modifiers).metadata?.secretsGained).toBe(2)
    })
})

describe('R-X.4 — before revision 23 The Old Oak counts the borrower’s own advisers', () => {
    it('the lender’s Beast adviser does not count, and the borrower’s does', () => {
        expect(reason(scene({ revision: BEFORE }))).toMatch(/you have no beast adviser/)
        const own = scene({ revision: BEFORE, dana: { advisers: [adviser(BIRDSONG), adviser(MASTER)] }, ann: { advisers: [adviser(SIGNAL)] } })
        expect(reason(own)).toBeUndefined()
        // Ann lends no Beast adviser, so only The Old Oak's one is gained.
        expect(trade(own).metadata?.secretsGained).toBe(1)
    })

    it('each revision’s disguised Trade replays unchanged', () => {
        // Before 23 only the borrower's own Beast adviser opens it (no lent Beast: one secret);
        // from 23 only the lender's (Birdsong matching, plus one).
        const ownBeast: Scene = { dana: { advisers: [adviser(BIRDSONG), adviser(MASTER)] }, ann: { advisers: [adviser(SIGNAL)] } }
        const cases: [number, Scene, number][] = [
            [BEFORE, ownBeast, 1],
            [AT, {}, 2]
        ]
        for (const [revision, over, gained] of cases) {
            const before = scene({ ...over, revision }).dehydrate()
            const game = testGame(['dana', 'ann', 'bea'])
            const action = buildAction(Trade, { playerId: 'dana', cardId: OAK, option: TradeOption.ForSecrets, modifiers: withOak() })
            const recorded = engine.runNext(action, structuredClone(before), game)
            expect(recorded.updatedState.players.find((p) => p.playerId === 'dana')?.secrets).toBe(2 - 1 + gained)

            let replayed = structuredClone(before)
            for (const processed of recorded.processedActions)
                replayed = engine.run(structuredClone(processed), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        }
    })
})

describe('The Old Oak and Master of Disguise on the borrower’s own view', () => {
    it('the Trade’s plan reads the same as on the whole state', () => {
        const view: Visibility.Perspective = { kind: 'player', playerId: 'dana' }
        const scenes = [
            scene(),
            scene({ dana: { advisers: [adviser(BIRDSONG), adviser(MASTER)] }, ann: { advisers: [adviser(SIGNAL), adviser(TENTS, false)] } }),
            scene({ ann: { advisers: [adviser(BIRDSONG, false)] } })
        ]
        for (const s of scenes) {
            const own = OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)
            for (const modifiers of [withOak(), withOak('bea'), [modifierUse(OAK)]]) {
                const whole = HydratedTrade.plan(s, 'dana', OAK, TradeOption.ForSecrets, modifiers)
                const seen = HydratedTrade.plan(own, 'dana', OAK, TradeOption.ForSecrets, modifiers)
                expect(seen.reason).toEqual(whole.reason)
                expect(seen.cost).toEqual(whole.cost)
            }
        }
    })
})

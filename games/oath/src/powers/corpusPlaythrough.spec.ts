import { OathTestEngine, thrownMessage } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { describe, expect, it } from 'vitest'
import { Color, type ActionResult } from '@tabletop/common'
import { OathRuntime } from '../definition/runtime.js'
import { cardDefinition, cardIdsOfKind } from '../data/cardRegistry.js'
import { cardPowers, PowerTiming, type CardPower } from '../data/cardPowers.js'
import { MachineState } from '../definition/states.js'
import { SearchPlay, SearchResolve, isSearchResolve } from '../actions/searchResolve.js'
import { UseActionPower, isUseActionPower } from '../actions/useActionPower.js'
import { UseRestPower, isUseRestPower } from '../actions/useRestPower.js'
import { CardKind, PlayerStatus } from '../model/oathEnums.js'
import { type OathProjectedState } from '../model/gameState.js'
import { testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { legalChoices, type PowerChoice } from '../util/powerChoice.js'
import { hasEffect } from './registry.js'
import { PLAYTEST_DECK } from '../data/playtestDeck.js'
import '../powers/index.js'
import { required } from '../testing/required.js'
import { testGame } from '../testing/game.js'
import { FILLER } from '../testing/cards.js'

const FILLER2 = 'denizen.hearth.wayside-inn'
function table(machineState: MachineState, me: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 6, secrets: 6, supply: 6, warbandsOnBoard: { [Color.Red]: 3 }, warbandsInPersonalBank: { [Color.Red]: 6 }, relicIds: ['relic.cup-of-plenty'], ...me }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 3, supply: 4, warbandsOnBoard: { [Color.Blue]: 2 }, warbandsInPersonalBank: { [Color.Blue]: 5 }, advisers: [{ cardId: 'denizen.nomad.tents', faceUp: false }], relicIds: ['relic.map'] }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', favor: 3, secrets: 3, supply: 4, warbandsInPersonalBank: { purple: 5 } })
        ],
        {
            machineState,
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: ['denizen.beast.wolves', 'denizen.hearth.storyteller'], c2: ['denizen.nomad.elders'], p1: ['denizen.arcane.tutor'], h1: [] },
            warbandsBySite: { c1: { [Color.Red]: 1, [Color.Blue]: 1 }, c2: { [Color.Red]: 2 }, p1: { purple: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            relicsBySite: { c1: [{ slotId: 'c1-r1' }] },
            reliquary: [{ slotId: 'reliquary.0' }, { slotId: 'reliquary.1' }, { slotId: 'reliquary.2' }, { slotId: 'reliquary.3' }],
            vault: testVaultWithRelics({
                'c1-r1': 'relic.bandit-crown',
                'reliquary.0': 'relic.book-of-records',
                'reliquary.1': 'relic.circlet-of-command',
                'reliquary.2': 'relic.cracked-horn',
                'reliquary.3': 'relic.dragonskin-drum'
            })
        }
    )
    const d = s.dehydrate()
    d.turnManager = { series: [{ type: 'turn', playerId: 'me', start: 0 }], turnOrder: ['me', 'foe', 'chan'], turnCounts: { me: 1, foe: 0, chan: 0 } }
    d.activePlayerIds = ['me']
    return { hydrated: s, state: d }
}
function defaultChoices(hydrated: ReturnType<typeof table>['hydrated'], power: CardPower, fillOptional = false): PowerChoice[] | undefined {
    const out: PowerChoice[] = []
    const used = new Map<string, number>()
    for (const l of legalChoices(hydrated, 'me', power)) {
        const want = l.spec.min > 0 ? l.spec.min : fillOptional ? Math.min(1, l.spec.max) : 0
        if (want === 0) continue
        if (l.options.length === 0) return l.spec.min > 0 ? undefined : out
        for (let i = 0; i < want; i++) {
            const n = used.get(l.spec.kind) ?? 0
            out.push(l.options[n % l.options.length])
            used.set(l.spec.kind, n + 1)
        }
    }
    return out
}

const CARDS = [...cardIdsOfKind(CardKind.Denizen), ...cardIdsOfKind(CardKind.Relic)].filter((id) => !PLAYTEST_DECK.includes(id) && cardPowers(id).some((p) => hasEffect(p)))
const NO_LEGAL_OPTION = 'a required choice has no legal option here'
const REFUSED_HERE: Record<string, string> = {
    'denizen.arcane.blood-pact#0': 'Cannot use action power: sacrifice an even number of warbands, not 3',
    'denizen.arcane.dream-thief#0': 'Cannot use action power: choose two different advisers',
    'denizen.arcane.terror-spells#0': 'Cannot use action power: you do not hold the Darkest Secret',
    'denizen.arcane.witchs-bargain#0': 'Cannot use action power: name at least one exchange',
    'denizen.beast.second-chance#0': NO_LEGAL_OPTION,
    'denizen.discord.enchantress#0': NO_LEGAL_OPTION,
    'denizen.hearth.armed-mob#0': NO_LEGAL_OPTION,
    'denizen.hearth.ballot-box#0': "Cannot use action power: you do not hold the People's Favor",
    'denizen.hearth.deed-writer#0': 'Cannot use action power: the exchange is empty',
    'denizen.hearth.tinkers-fair#0': 'Cannot use action power: the exchange is empty',
    // Its Q&A — nothing to reveal on an empty discard pile.
    'relic.brass-horse#0': 'Cannot use action power: your discard pile is empty',
    'relic.horned-mask#0': NO_LEGAL_OPTION,
    'relic.ivory-eye#0': 'Cannot use action power: Ivory Eye: choose exactly one thing to peek at',
    'relic.obsidian-cage#1': NO_LEGAL_OPTION,
    'relic.skeleton-key#0': 'Cannot use action power: Skeleton Key: the Chancellor does not rule your site'
}

describe('every built card beyond the deck fires through the engine, or says why not', () => {
    for (const cardId of CARDS) {
        const name = cardDefinition(cardId)?.name ?? cardId
        for (const power of cardPowers(cardId)) {
            if (!hasEffect(power) || ![PowerTiming.WhenPlayed, PowerTiming.Rest, PowerTiming.Action].includes(power.timing)) continue
            it(`${name} (${power.timing})`, () => {
                const engine = new OathTestEngine(OathRuntime)
                const game = testGame(['me', 'foe', 'chan'])
                const attempts: Array<() => ActionResult<OathProjectedState> | undefined> = []
                if (power.timing === PowerTiming.WhenPlayed) {
                    const { hydrated, state } = table(MachineState.Searching, { handIds: [cardId, FILLER, FILLER2] })
                    const play = cardDefinition(cardId)?.placement === 'adviser' ? SearchPlay.Adviser : SearchPlay.Site
                    for (const fill of [false, true]) attempts.push(() => {
                        const choices = defaultChoices(hydrated, power, fill)
                        if (choices === undefined) return undefined
                        return engine.runNext(buildAction(SearchResolve, { playerId: 'me', keptCardId: cardId, discardOrder: [FILLER, FILLER2], play, faceUp: play === SearchPlay.Adviser ? true : undefined, choices }), state, game)
                    })
                } else {
                    const phase = power.timing === PowerTiming.Rest ? MachineState.RestPhase : MachineState.ActPhase
                    const held = cardId.startsWith('relic.') ? { relicIds: [cardId] } : { advisers: [{ cardId, faceUp: true }] }
                    const { hydrated, state } = table(phase, held)
                    const schema = power.timing === PowerTiming.Rest ? UseRestPower : UseActionPower
                    for (const fill of [false, true]) attempts.push(() => {
                        const choices = defaultChoices(hydrated, power, fill)
                        if (choices === undefined) return undefined
                        return engine.runNext(buildAction(schema, { playerId: 'me', cardId, powerIndex: power.powerIndex, choices }), state, game)
                    })
                }
                const expectedRefusal = REFUSED_HERE[`${cardId}#${power.powerIndex}`]
                let lastError = NO_LEGAL_OPTION
                for (const attempt of attempts) {
                    try {
                        const next = attempt()
                        if (next) {
                            const summary =
                                power.timing === PowerTiming.WhenPlayed
                                    ? required(next.processedActions.find(isSearchResolve)?.metadata?.whenPlayed, `${name}'s When Played summary`)
                                    : required((next.processedActions.find(isUseActionPower) ?? next.processedActions.find(isUseRestPower))?.metadata, `${name}'s outcome`).summary
                            expect(summary).not.toMatch(/not implemented/)
                            expect(expectedRefusal, `${name} fired, so its REFUSED_HERE entry is stale`).toBeUndefined()
                            return
                        }
                    } catch (e) {
                        lastError = thrownMessage(e)
                        expect(lastError, `${name} crashed`).toMatch(/^Cannot |^Error: Cannot /)
                    }
                }
                expect(lastError, `${name} was refused`).toBe(expectedRefusal)
            })
        }
    }
})

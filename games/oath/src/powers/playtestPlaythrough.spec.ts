import { OathTestEngine, thrownMessage } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { describe, expect, it } from 'vitest'
import { Color, type ActionResult } from '@tabletop/common'
import { OathRuntime } from '../definition/runtime.js'
import { PLAYTEST_DECK } from '../data/playtestDeck.js'
import { cardDefinition } from '../data/cardRegistry.js'
import { cardPowers, PowerTiming, type CardPower } from '../data/cardPowers.js'
import { MachineState } from '../definition/states.js'
import { SearchPlay, SearchResolve, isSearchResolve } from '../actions/searchResolve.js'
import { UseActionPower, isUseActionPower } from '../actions/useActionPower.js'
import { UseRestPower, isUseRestPower } from '../actions/useRestPower.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { type OathProjectedState } from '../model/gameState.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { legalChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import '../powers/index.js'
import { required } from '../testing/required.js'
import { testGame } from '../testing/game.js'
import { FILLER } from '../testing/cards.js'

const FILLER2 = 'denizen.hearth.wayside-inn'

function table(machineState: MachineState, me: Record<string, unknown> = {}, stateOverride: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 6, secrets: 6, supply: 6, warbandsOnBoard: { [Color.Red]: 3 }, warbandsInPersonalBank: { [Color.Red]: 6 }, relicIds: ['relic.cup-of-plenty'], ...me }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 3, supply: 4, warbandsOnBoard: { [Color.Blue]: 2 }, warbandsInPersonalBank: { [Color.Blue]: 5 }, advisers: [{ cardId: 'denizen.nomad.tents', faceUp: true }], relicIds: ['relic.map'] }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', favor: 3, secrets: 3, supply: 4, warbandsInPersonalBank: { purple: 5 } })
        ],
        {
            machineState,
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: ['denizen.beast.wolves', 'denizen.hearth.storyteller'], c2: ['denizen.nomad.elders'], p1: ['denizen.arcane.tutor'], h1: [] },
            warbandsBySite: { c1: { [Color.Red]: 1, [Color.Blue]: 1 }, c2: { [Color.Red]: 2 }, p1: { purple: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            relicsBySite: { c1: [{ slotId: 'c1-r1' }] },
            ...stateOverride
        }
    )
    const d = s.dehydrate()
    d.turnManager = { series: [{ type: 'turn', playerId: 'me', start: 0 }], turnOrder: ['me', 'foe', 'chan'], turnCounts: { me: 1, foe: 0, chan: 0 } }
    d.activePlayerIds = ['me']
    return { hydrated: s, state: d }
}

function defaultChoices(hydrated: ReturnType<typeof table>['hydrated'], power: CardPower, fillOptional = false): PowerChoice[] | undefined {
    const legal = legalChoices(hydrated, 'me', power)
    const out: PowerChoice[] = []
    const usedByKind = new Map<string, number>()
    for (const l of legal) {
        const want = l.spec.min > 0 ? l.spec.min : fillOptional ? Math.min(1, l.spec.max) : 0
        if (want === 0) continue
        if (l.options.length === 0) return l.spec.min > 0 ? undefined : out
        for (let i = 0; i < want; i++) {
            const n = usedByKind.get(l.spec.kind) ?? 0
            const option = l.options[n % l.options.length]
            usedByKind.set(l.spec.kind, n + 1)
            out.push(option)
        }
    }
    return out
}

/** Printed preconditions the generic table does not meet, met per card. */
const FIXTURE: Record<string, { me?: Record<string, unknown>; state?: Record<string, unknown> }> = {
    'denizen.beast.vow-of-poverty': { me: { favor: 0 } },
    'denizen.discord.naysayers': { state: { oathkeeperPlayerId: 'foe' } }
}
/** Choices whose shape the defaults cannot guess: named outright. */
const CHOICES: Record<string, PowerChoice[]> = {
    'denizen.order.messenger': [{ kind: PowerChoiceKind.Warbands, group: { at: { kind: 'board', playerId: 'me' }, color: Color.Red, count: 1 } }, { kind: PowerChoiceKind.Site, siteId: 'c2' }],
    'denizen.beast.memory-of-nature': [{ kind: PowerChoiceKind.FavorBank, suit: Suit.Hearth }]
}

const NO_LEGAL_OPTION = 'a required choice has no legal option here'

describe('the playtest deck fires through the engine', () => {
    for (const cardId of PLAYTEST_DECK) {
        const name = cardDefinition(cardId)?.name ?? cardId
        for (const power of cardPowers(cardId)) {
            if (![PowerTiming.WhenPlayed, PowerTiming.Rest, PowerTiming.Action].includes(power.timing)) continue
            it(`${name} (${power.timing})`, () => {
                const engine = new OathTestEngine(OathRuntime)
                const game = testGame(['me', 'foe', 'chan'])
                if (power.timing === PowerTiming.WhenPlayed) {
                    const fx = FIXTURE[cardId] ?? {}
                    const { hydrated, state } = table(MachineState.Searching, { handIds: [cardId, FILLER, FILLER2], ...fx.me }, fx.state)
                    const play = cardDefinition(cardId)?.placement === 'adviser' ? SearchPlay.Adviser : SearchPlay.Site
                    const choices = required(CHOICES[cardId] ?? defaultChoices(hydrated, power), `${name}: ${NO_LEGAL_OPTION}`)
                    const result = engine.runNext(buildAction(SearchResolve, { playerId: 'me', keptCardId: cardId, discardOrder: [FILLER, FILLER2], play, faceUp: play === SearchPlay.Adviser ? true : undefined, choices }), state, game)
                    const next = result.updatedState
                    const last = required(result.processedActions.find(isSearchResolve), 'the Search resolution')
                    expect([MachineState.ActPhase, MachineState.RestPhase, MachineState.PowerQuestion, MachineState.OathkeeperChoice]).toContain(next.machineState)
                    expect(required(next.players.find((p) => p.playerId === 'me'), 'the seat me').handIds).toEqual([])
                    expect(required(last.metadata?.whenPlayed, `${name}'s When Played summary`)).not.toMatch(/not implemented/)
                    return
                }
                const phase = power.timing === PowerTiming.Rest ? MachineState.RestPhase : MachineState.ActPhase
                const fx = FIXTURE[cardId] ?? {}
                const { hydrated, state } = table(phase, { advisers: [{ cardId, faceUp: true }], ...fx.me }, fx.state)
                const schema = power.timing === PowerTiming.Rest ? UseRestPower : UseActionPower
                let next: ActionResult<OathProjectedState> | undefined
                let lastError = NO_LEGAL_OPTION
                for (const choices of [CHOICES[cardId] ?? defaultChoices(hydrated, power), defaultChoices(hydrated, power, true)]) {
                    if (choices === undefined) continue
                    try {
                        next = engine.runNext(buildAction(schema, { playerId: 'me', cardId, powerIndex: power.powerIndex, choices }), state, game)
                        break
                    } catch (e) {
                        lastError = thrownMessage(e)
                    }
                }
                const fired = required(next, `${name}: ${lastError}`)
                const last = required(fired.processedActions.find(isUseActionPower) ?? fired.processedActions.find(isUseRestPower), 'the power use')
                expect(required(last.metadata, `${name}'s outcome`).summary).not.toMatch(/not implemented/)
            })
        }
    }
})

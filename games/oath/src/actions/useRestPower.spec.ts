import { afterEach, describe, expect, it } from 'vitest'
import { assertExists, Color } from '@tabletop/common'
import { HydratedUseRestPower, UseRestPower } from './useRestPower.js'
import { HydratedUseActionPower, UseActionPower } from './useActionPower.js'
import { Region } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import { effectFor, registerEffect, type EffectDefinition, type EffectResult } from '../powers/registry.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { INN } from '../testing/cards.js'

const INSOMNIA = 'denizen.discord.insomnia'
const ELDERS = 'denizen.nomad.elders'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const ME = 'me'

const REST = powersWithTiming(INSOMNIA, PowerTiming.Rest)[0]
const ACTION = powersWithTiming(ELDERS, PowerTiming.Action)[0]
const originalRest = effectFor(REST)
const originalAction = effectFor(ACTION)

function restore(cardId: string, index: number, original: EffectDefinition | undefined) {
    assertExists(original, `${cardId} has no registered effect to restore`)
    registerEffect(cardId, index, original)
}

afterEach(() => {
    restore(INSOMNIA, REST.powerIndex, originalRest)
    restore(ELDERS, ACTION.powerIndex, originalAction)
})

function probe(result: EffectResult): EffectDefinition {
    return { choices: [], resolve: () => result }
}

function board() {
    const s = testState([
        testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', favor: 4, secrets: 2, advisers: [{ cardId: INSOMNIA, faceUp: true }, { cardId: ELDERS, faceUp: true }] })
    ])
    openTurn(s, ME)
    const vault = s.requireVault()
    vault.relicDeck = ['relic.cup', 'relic.map']
    vault.discardPiles[Region.Hinterland] = [INN]
    vault.discardPiles[Region.Cradle] = [TENTS]
    return s
}

function rest(s: HydratedOathGameState) {
    const a = new HydratedUseRestPower(buildAction(UseRestPower, { playerId: ME, cardId: INSOMNIA, powerIndex: REST.powerIndex }))
    a.apply(s)
    return a
}

function act(s: HydratedOathGameState) {
    const a = new HydratedUseActionPower(buildAction(UseActionPower, { playerId: ME, cardId: ELDERS, powerIndex: ACTION.powerIndex }))
    a.apply(s)
    return a
}

const everything: EffectResult = {
    summary: 'probe',
    rolled: true,
    relicToDeckBottom: 'relic.cup',
    peeked: [INN],
    mergePiles: { from: Region.Hinterland, to: Region.Cradle },
    pileDeposits: [{ region: Region.Provinces, cardIds: [WOLVES] }]
}

describe('UseRestPower carries what UseActionPower carries', () => {
    it('carries the whole outcome, and commits it to the vault as an Action power would', () => {
        registerEffect(INSOMNIA, REST.powerIndex, probe(everything))
        registerEffect(ELDERS, ACTION.powerIndex, probe(everything))
        const restState = board()
        const actionState = board()
        const r = rest(restState)
        const a = act(actionState)

        expect(r.metadata).toEqual({ summary: 'probe', rolled: true, relicToDeckBottom: 'relic.cup', peeked: [INN], mergePiles: { from: Region.Hinterland, to: Region.Cradle }, pileDeposits: [{ region: Region.Provinces, cardIds: [WOLVES] }] })
        expect(r.metadata).toEqual(a.metadata)
        expect(r.revealsInfo).toBe(true)

        const vault = restState.requireVault()
        expect(vault.relicDeck).toEqual(['relic.map', 'relic.cup'])
        expect(vault.discardPiles[Region.Cradle]).toEqual([INN, TENTS])
        expect(vault.discardPiles[Region.Provinces]).toEqual([WOLVES])
        expect(vault).toEqual(actionState.requireVault())
    })

    it('a deposit alone makes it irreversible (R-X.3)', () => {
        registerEffect(INSOMNIA, REST.powerIndex, probe({ summary: 'probe', pileDeposits: [{ region: Region.Provinces, cardIds: [WOLVES] }] }))
        const s = board()
        const r = rest(s)
        expect(r.revealsInfo).toBe(true)
        expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([WOLVES])
    })

    it('reads the vault it asks for, and shows the read to its player', () => {
        registerEffect(INSOMNIA, REST.powerIndex, {
            choices: [],
            hidden: () => ({ kind: 'worldDeckPeek', count: 2 }),
            resolve: (ctx) => ({ summary: 'probe', peeked: ctx.reveal?.kind === 'peek' ? ctx.reveal.cardIds : [] })
        })
        const s = board()
        s.requireVault().worldDeck = [WOLVES, INN, TENTS]
        const r = rest(s)
        expect(r.metadata?.reveal).toEqual({ kind: 'peek', cardIds: [WOLVES, INN] })
        expect(r.metadata?.peeked).toEqual([WOLVES, INN])
        expect(r.revealsInfo).toBe(true)
    })

    it('a reveal the client sends is never read, recorded or made an Undo barrier', () => {
        registerEffect(INSOMNIA, REST.powerIndex, {
            choices: [],
            resolve: (ctx) => ({ summary: 'probe', peeked: ctx.reveal?.kind === 'peek' ? ctx.reveal.cardIds : undefined })
        })
        const s = board()
        const sent = buildAction(UseRestPower, { playerId: ME, cardId: INSOMNIA, powerIndex: REST.powerIndex })
        const forged = { ...sent, reveal: { kind: 'peek', cardIds: [WOLVES] } }
        const r = new HydratedUseRestPower(forged)
        r.apply(s)
        expect(r.metadata?.peeked).toBeUndefined()
        expect(r.metadata?.reveal).toBeUndefined()
        expect(r.revealsInfo).toBe(false)
    })

    it('an ordinary Rest power stays optimistic: it never reads the vault, and it can be undone', () => {
        const s = board()
        s.vault = undefined
        const r = rest(s)
        expect(r.metadata).toEqual({ summary: 'Insomnia: gained 1 secret' })
        expect(r.revealsInfo).toBe(false)
        expect(s.getPlayerState(ME).secrets).toBe(3)
    })
})

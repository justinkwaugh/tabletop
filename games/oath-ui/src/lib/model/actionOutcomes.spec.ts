import { describe, expect, it } from 'vitest'
import {
    AnswerQuestion,
    EndActPhase,
    MachineState,
    PowerQuestionKind,
    Region,
    SearchPlay,
    SearchResolve,
    UseActionPower
} from '@tabletop/oath'
import { buildAction } from '@tabletop/oath/testing'
import {
    actorOnlyCards,
    actorOnlyOutcome,
    latestActorNotice,
    latestActorOnlyCards,
    latestActorOnlyOutcome,
    mergedPilesOf,
    pileDepositsOf
} from './actionOutcomes.js'
import { describeAction } from './actionDescription.js'
import { slotLabel } from './names.js'

const nameOf = { player: (playerId: string) => ({ me: 'Alice', other: 'Bob' })[playerId] ?? playerId, site: slotLabel, seats: ['me', 'other'] }

const powerUse = buildAction(UseActionPower, {
    playerId: 'me',
    cardId: 'relic.dowsing-sticks',
    powerIndex: 0,
    choices: [],
    metadata: {
        summary: 'drew a relic',
        peeked: ['relic.map'],
        pileDeposits: [{ region: Region.Cradle, cardIds: ['denizen.order.messenger'] }],
        mergePiles: { from: Region.Provinces, to: Region.Hinterland }
    }
})

const keepOrBottom = buildAction(AnswerQuestion, {
    playerId: 'me',
    answer: { kind: PowerQuestionKind.KeepOrBottomRelic, keep: false },
    metadata: {
        cardId: 'denizen.hearth.family-heirloom',
        kind: PowerQuestionKind.KeepOrBottomRelic,
        summary: 'put the relic on the bottom of the relic deck',
        resumeMachineState: MachineState.ActPhase,
        last: true,
        relicToDeckBottom: 'relic.map'
    }
})

const stacked = buildAction(AnswerQuestion, {
    playerId: 'me',
    answer: { kind: PowerQuestionKind.OrderDrawnCards, order: [1, 0] },
    metadata: {
        cardId: 'denizen.nomad.pilgrimage',
        kind: PowerQuestionKind.OrderDrawnCards,
        summary: 'stacked 2 cards on the cradle discard pile',
        resumeMachineState: MachineState.ActPhase,
        last: true,
        pileDeposits: [
            { region: Region.Cradle, cardIds: ['denizen.order.messenger', 'denizen.nomad.tents'] }
        ]
    }
})

const endPhase = buildAction(EndActPhase, { playerId: 'me' })

describe('actorOnlyOutcome', () => {
    it('shows the actor what the power showed them', () => {
        expect(actorOnlyOutcome(powerUse, 'me')).toEqual({
            peeked: ['relic.map'],
            relicToDeckBottom: undefined
        })
        expect(actorOnlyOutcome(keepOrBottom, 'me')).toEqual({
            peeked: undefined,
            relicToDeckBottom: 'relic.map'
        })
    })

    it('shows nobody else, whatever the client holds', () => {
        expect(actorOnlyOutcome(powerUse, 'other')).toBeUndefined()
        expect(actorOnlyOutcome(keepOrBottom, undefined)).toBeUndefined()
    })

    it('an action with nothing seen carries nothing', () => {
        expect(actorOnlyOutcome(endPhase, 'me')).toBeUndefined()
    })
})

describe('latestActorOnlyOutcome', () => {
    it('reads only the viewer’s latest action', () => {
        expect(latestActorOnlyOutcome([powerUse], 'me')?.peeked).toEqual(['relic.map'])
        expect(latestActorOnlyOutcome([powerUse, endPhase], 'me')).toBeUndefined()
        expect(latestActorOnlyOutcome([powerUse], 'other')).toBeUndefined()
    })
})

describe('actorOnlyCards — what the notice and the history row picture for the actor', () => {
    const searched = buildAction(SearchResolve, {
        playerId: 'me',
        keptCardId: 'denizen.nomad.tents',
        discardOrder: ['denizen.order.messenger'],
        play: SearchPlay.Adviser,
        metadata: { discardedCardIds: ['denizen.order.messenger'], discardedCount: 1, discardPileRegion: Region.Cradle, favorGained: 0 }
    })

    it('pictures a peek, then the pile deposit, each card once', () => {
        expect(actorOnlyCards(powerUse, 'me')).toEqual(['relic.map', 'denizen.order.messenger'])
    })

    it('pictures the relic sent to the bottom, the cards stacked, and a Search’s discards', () => {
        expect(actorOnlyCards(keepOrBottom, 'me')).toEqual(['relic.map'])
        expect(actorOnlyCards(stacked, 'me')).toEqual(['denizen.order.messenger', 'denizen.nomad.tents'])
        expect(actorOnlyCards(searched, 'me')).toEqual(['denizen.order.messenger'])
    })

    it('pictures nothing for anyone else, and nothing for an action that showed nothing', () => {
        for (const action of [powerUse, keepOrBottom, stacked, searched]) {
            expect(actorOnlyCards(action, 'other')).toEqual([])
            expect(actorOnlyCards(action, undefined)).toEqual([])
        }
        expect(actorOnlyCards(endPhase, 'me')).toEqual([])
    })

    it('the notice reads only the viewer’s latest action', () => {
        expect(latestActorOnlyCards([powerUse], 'me')).toEqual(['relic.map', 'denizen.order.messenger'])
        expect(latestActorOnlyCards([powerUse, endPhase], 'me')).toEqual([])
    })
})

describe('pile deposits and merges', () => {
    it('are read from the records that carry them', () => {
        expect(pileDepositsOf(powerUse)).toEqual([
            { region: Region.Cradle, cardIds: ['denizen.order.messenger'] }
        ])
        expect(mergedPilesOf(powerUse)).toEqual({ from: Region.Provinces, to: Region.Hinterland })
        expect(pileDepositsOf(endPhase)).toEqual([])
    })

    it('the history names the region to everyone and the cards to the actor alone', () => {
        const toActor = describeAction(powerUse, nameOf, 'me')
        const toOther = describeAction(powerUse, nameOf, 'other')
        expect(toActor).toContain('Messenger went to the cradle discard pile')
        expect(toActor).toContain('you saw')
        expect(toOther).toContain('cards went to the cradle discard pile')
        expect(toOther).not.toContain('Messenger')
        expect(toOther).not.toContain('you saw')
        expect(toOther).toContain('the provinces discard pile went onto the hinterland pile')
    })

    it('an answer that stacks cards on a pile (Pilgrimage) names them to its actor alone', () => {
        expect(pileDepositsOf(stacked)).toEqual([
            { region: Region.Cradle, cardIds: ['denizen.order.messenger', 'denizen.nomad.tents'] }
        ])
        expect(describeAction(stacked, nameOf, 'me')).toContain('Messenger')
        expect(describeAction(stacked, nameOf, 'other')).toContain('cards went to the cradle discard pile')
        expect(describeAction(stacked, nameOf, 'other')).not.toContain('Messenger')
    })

    it('the relic sent to the bottom is named to its actor alone', () => {
        expect(describeAction(keepOrBottom, nameOf, 'me')).toContain(
            'on the bottom of the relic deck'
        )
        expect(describeAction(keepOrBottom, nameOf, 'other')).not.toContain('you put')
    })
})

describe('latestActorNotice — what the notice above the panel shows', () => {
    it('shows the actor a peek and names the card that showed it', () => {
        expect(latestActorNotice([powerUse], 'me')).toEqual({
            shownBy: 'relic.dowsing-sticks',
            cards: ['relic.map'],
            relicToDeckBottom: undefined
        })
    })

    it('shows the relic sent under the deck, named by the question’s card', () => {
        expect(latestActorNotice([keepOrBottom], 'me')?.shownBy).toBe('denizen.hearth.family-heirloom')
        expect(latestActorNotice([keepOrBottom], 'me')?.cards).toEqual(['relic.map'])
    })

    it('shows nothing for the actor’s own discards or stacked cards', () => {
        const search = buildAction(SearchResolve, {
            playerId: 'me',
            keptCardId: 'denizen.nomad.tents',
            play: SearchPlay.Adviser,
            metadata: {
                discardedCardIds: ['vision.faith'],
                discardedCount: 1,
                discardPileRegion: Region.Provinces,
                favorGained: 0
            }
        })
        expect(latestActorNotice([search], 'me')).toBeUndefined()
        expect(latestActorNotice([stacked], 'me')).toBeUndefined()
    })

    it('clears on any next action, and shows nobody else', () => {
        expect(latestActorNotice([powerUse, endPhase], 'me')).toBeUndefined()
        expect(latestActorNotice([powerUse], 'other')).toBeUndefined()
    })
})

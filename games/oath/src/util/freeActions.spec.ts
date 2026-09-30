import { describe, expect, it } from 'vitest'
import { assertExists, ActionSource, Color, type GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { engine } from '../testing/engine.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { ConsentRequestKind } from '../model/consent.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerChoiceKind } from './powerChoice.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { hasFreeActionAhead } from './freeActions.js'
import { testPlayer, testState, withChancellor } from '../testing/fixture.js'
import '../powers/index.js'
import { Region } from '../model/oathEnums.js'
import { testGame } from '../testing/game.js'

const BRASS_HORSE = 'relic.brass-horse'
const GRAND_SCEPTER = 'relic.grand-scepter'
const WILD_ALLIES = 'denizen.beast.wild-allies'
const WOLVES = 'denizen.beast.wolves'

const X = 'x'
const Y = 'y'
const H = 'h'

const game = testGame([X, Y, H])

function board(over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    return testState(
        withChancellor([
            testPlayer({ playerId: X, color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { [X]: 4 }, ...over[X] }),
            testPlayer({ playerId: Y, color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 6, ...over[Y] }),
            testPlayer({ playerId: H, color: Color.Yellow, siteId: 'p1', favor: 1, supply: 6, ...over[H] })
        ]),
        { denizensBySite: { c1: [], c2: [WOLVES], p1: [], h1: [] }, ...state }
    )
}

class Table {
    state: OathProjectedState
    processed: GameAction[] = []
    private seq = 0

    constructor(s: HydratedOathGameState, active = X) {
        this.state = s.dehydrate()
        this.state.turnManager = { series: [{ type: 'turn', playerId: X, start: 0 }], turnOrder: [X, Y, H], turnCounts: { [X]: 1, [Y]: 1, [H]: 1 } }
        this.state.activePlayerIds = [active]
    }

    run(fields: { type: ActionType; playerId: string } & Record<string, unknown>) {
        const action: GameAction = { id: `fa-${(this.seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index: this.state.actionCount, ...fields }
        const result = engine.run(action, this.state, game)
        this.state = result.updatedState
        this.processed = result.processedActions
        return this
    }

    player(playerId: string) {
        const found = this.state.players.find((p) => p.playerId === playerId)
        assertExists(found, `no player ${playerId}`)
        return found
    }

    travel() {
        const supply = this.player(X).supply
        this.run({ type: ActionType.Travel, playerId: X, siteId: 'c2' })
        expect(this.player(X).siteId).toBe('c2')
        return supply - this.player(X).supply
    }
}

describe('a free action waits for its grantee’s own Act Phase action', () => {
    it('R-6.4 — the Scepter’s holder is peeked for by nothing, so Brass Horse’s free Travel is the next action and still free', () => {
        const s = board({ [X]: { relicIds: [GRAND_SCEPTER, BRASS_HORSE] } })
        for (const slot of s.reliquarySlots()) s.requireVault().relicFacedown[slot.slotId] = `relic.test-${slot.slotId}`
        // A Vision on top names no suit, so the Travel is "as normal".
        for (const region of [Region.Cradle, Region.Provinces, Region.Hinterland]) {
            s.requireVault().discardPiles[region] = ['vision.faith']
            s.discardPileCounts[region] = 1
        }
        const t = new Table(s)
        t.run({ type: ActionType.UseActionPower, playerId: X, cardId: BRASS_HORSE, powerIndex: powerIndexOf(BRASS_HORSE, PowerTiming.Action) })
        expect(t.processed.map((a) => [a.type, a.source])).toEqual([[ActionType.UseActionPower, ActionSource.User]])
        expect(t.player(X).freeTravelAtAction).toBe(t.state.actionCount)
        expect(t.travel()).toBe(0)
    })

    it('Wild Allies: the Campaign "as if your pawn is there" moves along with the free Campaign', () => {
        const s = board({ [X]: { relicIds: [GRAND_SCEPTER], advisers: [{ cardId: WILD_ALLIES, faceUp: true }] } })
        for (const slot of s.reliquarySlots()) s.requireVault().relicFacedown[slot.slotId] = `relic.test-${slot.slotId}`
        const t = new Table(s)
        t.run({ type: ActionType.UseActionPower, playerId: X, cardId: WILD_ALLIES, powerIndex: powerIndexOf(WILD_ALLIES, PowerTiming.Action), choices: [{ kind: PowerChoiceKind.Site, siteId: 'c2' }] })
        expect(t.processed.filter((a) => a.type === ActionType.Peek)).toHaveLength(0)
        expect(t.player(X).freeCampaignAtAction).toBe(t.state.actionCount)
        expect(t.player(X).campaignAsIf).toEqual({ siteId: 'c2', atAction: t.state.actionCount })
    })

    it('an Oathkeeper choice (R-2.11.b) by another player carries it', () => {
        const s = board({ [X]: { freeTravelAtAction: 0 } }, { machineState: MachineState.OathkeeperChoice, oathkeeperPlayerId: Y, pendingOathkeeperChoice: { holderPlayerId: Y, candidates: [X, H], resumeMachineState: MachineState.ActPhase } })
        const t = new Table(s, Y)
        t.run({ type: ActionType.ResolveOathkeeper, playerId: Y, chosenPlayerId: X })
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.player(X).freeTravelAtAction).toBe(t.state.actionCount)
        expect(t.travel()).toBe(0)
    })

    it('an answer to a Citizenship offer (R-6.6.1) carries it', () => {
        const s = board(
            { [X]: { status: PlayerStatus.Chancellor, freeTravelAtAction: 0 } },
            { machineState: MachineState.ConsentRequest, chancellorPlayerId: X, pendingConsent: { request: { kind: ConsentRequestKind.CitizenshipOffer, exilePlayerId: Y, reliquarySlotId: 'reliquary.0' }, askingPlayerId: X, askedPlayerId: Y, resumeMachineState: MachineState.ActPhase } }
        )
        const t = new Table(s, Y)
        t.run({ type: ActionType.ResolveCitizenshipOffer, playerId: Y, granted: false })
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.player(X).freeTravelAtAction).toBe(t.state.actionCount)
        expect(t.travel()).toBe(0)
    })

    it("the grantee's own Act Phase action is the one the grant names: taking another spends it", () => {
        const s = board({ [X]: { freeTravelAtAction: 0 } })
        const t = new Table(s)
        t.run({ type: ActionType.EndActPhase, playerId: X })
        expect(hasFreeActionAhead(new HydratedOathGameState(t.state), X)).toBe(false)
    })
})

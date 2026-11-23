// @vitest-environment node
import { buildFeudum } from '@tabletop/feudum/testing'
import { render } from 'svelte/server'
import { afterEach, describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    HydratedFeudumGameState,
    RoyalWrits,
    placeMarker,
    type WritId
} from '@tabletop/feudum'
import { FlightAnimator } from '$lib/animators/flightAnimator.svelte.js'
import { planFlights, type FlightPlan } from '$lib/animators/flightPlan.js'
import { writName } from '$lib/model/writLabels.js'
import type { FeudumHost } from '$lib/testing/sessionHarness.js'
import { seatedAtCards } from '$lib/testing/followUpTable.js'
import { atPlayingCards, emptySpace, returnGoods } from '$lib/testing/turnTable.js'
import FlightLayer from './FlightLayer.svelte'

let host: FeudumHost | undefined

afterEach(() => {
    host?.close()
    host = undefined
})

function markupOf(plan: FlightPlan): string {
    const animator = new FlightAnimator(() => false)
    animator.flights = plan.flights
    return render(FlightLayer, {
        props: {
            animator,
            paintOf: () => ({ fill: '#123456', ink: '#ffffff', edge: '#000000', owner: "Ana's" })
        }
    }).body
}

async function drawScene(writId: WritId) {
    const table = await atPlayingCards(['move'], { otherCards: ['move'] })
    host = table.host
    const from = new HydratedFeudumGameState(structuredClone(table.host.state))
    const to = new HydratedFeudumGameState(structuredClone(table.host.state))
    to.flow.writDraw = {
        drawnCount: 1,
        keep: 1,
        source: 'explore',
        shovelsOffered: false
    }
    to.getPlayerState(table.seat).writsDrawn = []
    const action = {
        id: 'action',
        gameId: 'game',
        playerId: table.seat,
        source: ActionSource.User,
        type: ActionType.Explore,
        metadata: { drawnCount: 1, keep: 1, drawnWritIds: [writId] }
    }
    return { ...table, from, to, action }
}

describe('R-5.3 the markup of a flying copy', () => {
    it('R-3.10.1 a back on the layer names nothing; a face names its writ for its drawer alone', async () => {
        const writId = RoyalWrits[0].id
        const { seat, other, from, to, action } = await drawScene(writId)
        const drawer = markupOf(planFlights({ from, to, action, viewerId: seat }))
        expect(drawer).toContain('data-flight-face="writ"')
        expect(drawer).toContain(writName(writId))
        for (const viewerId of [other, undefined]) {
            const markup = markupOf(planFlights({ from, to, action, viewerId }))
            expect(markup).toContain('data-flight-face="writ"')
            expect(markup).not.toContain(writId)
            expect(markup).not.toContain(writName(writId))
        }
    })

    it('R-5.3 a spectator’s copy, from the projection it receives: the state and Action hold no id, the markup a back', async () => {
        const table = await seatedAtCards(['explore', 'tax'], (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'outpost'))
            buildFeudum(state, seat, emptySpace(state, 'farm'))
            state.recomputeRanks()
            returnGoods(state, seat)
        })
        host = table.host
        const before = table.host.projected({ kind: 'spectator' })
        await table.host.send(table.seat, { type: ActionType.Explore, revealsInfo: true })
        const after = table.host.projected({ kind: 'spectator' })
        const drawn = new HydratedFeudumGameState(structuredClone(table.host.state)).getPlayerState(
            table.seat
        ).writsDrawn
        expect(drawn?.length).toBeGreaterThan(0)
        const received = JSON.stringify({ state: after.currentState, actions: after.actions })
        const markup = markupOf(
            planFlights({
                from: new HydratedFeudumGameState(before.currentState),
                to: new HydratedFeudumGameState(after.currentState),
                action: after.actions.at(-1)
            })
        )
        expect(markup).toContain('data-flight-face="writ"')
        for (const writId of drawn ?? []) {
            expect(received).not.toContain(writId)
            expect(markup).not.toContain(writId)
            expect(markup).not.toContain(writName(writId))
        }
    })

    it('R-5-H1 a seal’s copy is one anonymous disc: no id and no value', async () => {
        const { seat, from, to } = await drawScene(RoyalWrits[0].id)
        to.flow.writDraw = undefined
        to.getPlayerState(seat).sealCount += 1
        to.supply.sealPileCount -= 1
        const markup = markupOf(
            planFlights({
                from,
                to,
                action: {
                    id: 'action',
                    gameId: 'game',
                    playerId: seat,
                    source: ActionSource.User,
                    type: ActionType.ForfeitCard
                }
            })
        )
        expect(markup).toContain('data-flight-face="seal"')
        expect(markup).not.toMatch(/data-seal-id|data-bead/)
    })
})

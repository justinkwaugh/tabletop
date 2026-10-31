import { Visibility, assertExists, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isEndTurn } from '../actions/endTurn.js'
import { isScrapTrack } from '../actions/scrapTrack.js'
import { WALKS, history, walk } from '../testing/seededWalk.js'
import { ActionType } from './actions.js'
import { PromontoryPointApiActions } from './apiActions.js'
import { PromontoryPointRuntime } from './runtime.js'

const spectator = { kind: 'spectator' } as const

type Recorded = { action: GameAction; actorId: string; otherSeatId: string }

// Every action record of the seeded games, with its actor and another seat.
const RECORDED: Recorded[] = WALKS.flatMap((setting) => {
    const walked = walk(setting)
    const playerIds = walked.initial.turnManager.turnOrder
    return history(walked).map((action) => {
        const actorId = action.playerId
        assertExists(actorId, 'Every Promontory Point action names its player')
        const otherSeatId = playerIds.find((playerId) => playerId !== actorId)
        assertExists(otherSeatId, 'A game seats at least two players')
        return { action, actorId, otherSeatId }
    })
})

function project(action: GameAction, perspective: Visibility.Perspective): GameAction {
    return PromontoryPointRuntime.visibility.actions.project(action, perspective)
}

// The engine's patches never travel with a projected record; each perspective's are rebuilt.
function withoutPatches(action: GameAction): GameAction {
    const record = structuredClone(action)
    delete record.undoPatch
    delete record.forwardPatch
    return record
}

function recordedOf(type: ActionType): Recorded[] {
    return RECORDED.filter(({ action }) => action.type === type)
}

describe('Promontory Point action projection', () => {
    it('R-5: the seeded games record every registered action type', () => {
        expect(Object.keys(PromontoryPointApiActions).sort()).toEqual(
            Object.values(ActionType).sort()
        )
        expect(new Set(RECORDED.map(({ action }) => action.type))).toEqual(
            new Set(Object.keys(PromontoryPointApiActions))
        )
    })

    it.each(Object.values(ActionType))(
        'R-5: %s keeps its type and is projected for its actor, another seat and a spectator',
        (type) => {
            const records = recordedOf(type)
            expect(records.length).toBeGreaterThan(0)
            for (const { action, actorId, otherSeatId } of records) {
                for (const perspective of [
                    { kind: 'player', playerId: actorId } as const,
                    { kind: 'player', playerId: otherSeatId } as const,
                    spectator
                ]) {
                    const projected = project(action, perspective)
                    expect(projected.type).toBe(type)
                    expect(Visibility.isRedactedAction(projected)).toBe(false)
                    expect(projected).not.toHaveProperty('undoPatch')
                    expect(projected).not.toHaveProperty('forwardPatch')
                }
                expect(project(action, { kind: 'player', playerId: actorId })).toEqual(
                    withoutPatches(action)
                )
            }
        }
    )

    it.each(Object.values(ActionType).filter((type) => type !== ActionType.EndTurn))(
        'R-5, R-1.3-H1: every field of %s is public',
        (type) => {
            for (const { action, otherSeatId } of recordedOf(type)) {
                expect(project(action, { kind: 'player', playerId: otherSeatId })).toEqual(
                    withoutPatches(action)
                )
                expect(project(action, spectator)).toEqual(withoutPatches(action))
            }
        }
    )

    it("R-2.2 step 4, R-5, R-6.3, R-6.3-H2: EndTurn's drawn pieces reach the drawer alone; the count, the keep-or-return choice and the leftover piece are public", () => {
        const endTurns = RECORDED.filter(({ action }) => isEndTurn(action))
        expect(endTurns.some(({ action }) => isEndTurn(action) && action.metadata?.leftover)).toBe(
            true
        )
        expect(
            endTurns.some(({ action }) => isEndTurn(action) && action.metadata?.leftoverPiece)
        ).toBe(true)
        for (const { action, actorId, otherSeatId } of endTurns) {
            if (!isEndTurn(action)) continue
            const metadata = action.metadata
            assertExists(metadata, 'EndTurn records what it drew')
            const own = project(action, { kind: 'player', playerId: actorId })
            expect(own).toHaveProperty('metadata.drawn', metadata.drawn)
            for (const perspective of [
                { kind: 'player', playerId: otherSeatId } as const,
                spectator
            ]) {
                const projected = project(action, perspective)
                expect(projected).not.toHaveProperty('metadata.drawn')
                expect(projected).toEqual({
                    ...withoutPatches(action),
                    metadata: {
                        drawnCount: metadata.drawnCount,
                        ...(metadata.leftover === undefined ? {} : { leftover: metadata.leftover }),
                        ...(metadata.leftoverPiece === undefined
                            ? {}
                            : { leftoverPiece: metadata.leftoverPiece })
                    }
                })
            }
        }
    })

    it("R-3.3-H1, R-5: ScrapTrack's replacement, drawn face up, is public", () => {
        const drawing = RECORDED.filter(
            ({ action }) => isScrapTrack(action) && action.metadata?.bagEmpty === false
        )
        expect(drawing.length).toBeGreaterThan(0)
        for (const { action, otherSeatId } of drawing) {
            if (!isScrapTrack(action)) continue
            const replacement = action.metadata?.replacement
            assertExists(replacement, 'A drawing scrap records its replacement')
            for (const perspective of [
                { kind: 'player', playerId: otherSeatId } as const,
                spectator
            ]) {
                expect(project(action, perspective)).toHaveProperty(
                    'metadata.replacement',
                    replacement
                )
            }
        }
    })
})

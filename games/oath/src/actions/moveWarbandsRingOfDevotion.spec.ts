import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedMoveWarbands } from './moveWarbands.js'
import { ActionType } from '../definition/actions.js'
import { OathVisibility } from '../definition/runtime.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { WarbandMoveKind, type WarbandMoveOption } from '../model/warbandMove.js'
import { ActPhaseStateHandler } from '../stateHandlers/actPhase.js'
import { machineContext } from '../testing/actions.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { served } from '../testing/projection.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Ring of Devotion: "You cannot place warbands at sites." Its Q&A: the holder cannot drop off
// warbands with the R-6.5 minor action. The move from the board to the pawn's site is refused at
// every revision, so it is not offered either; a lift from the site to the board places nothing
// and stays offered.

const RING = 'relic.ring-of-devotion'
const BANDIT_CROWN = 'relic.bandit-crown'
const REVISIONS = [OathRevision.EngineFixes26, OathRevision.Chronicle, OathRevision.TurnFlow]

/** Rhys stands at c1 with 3 warbands on their board and `atC1` at c1, holding `relics`. Dana rules c2. */
function table(
    revision: OathRevision,
    atC1: number,
    relics: string[] = [RING]
): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c2' }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c1',
                warbandsOnBoard: { rhys: 3 },
                relicIds: relics
            })
        ],
        { oathRevision: revision, warbandsBySite: { c1: { rhys: atC1 }, c2: { dana: 2 } } }
    )
    openTurn(s, 'rhys')
    return s
}

function describeOption(option: WarbandMoveOption): string {
    const other = 'otherPlayerId' in option.move ? ` ${option.move.otherPlayerId}` : ''
    return `${option.move.kind}${other} ${option.owner}:${option.max}`
}

function offered(s: HydratedOathGameState, playerId = 'rhys'): string[] {
    return HydratedMoveWarbands.legalMoves(s, playerId).map(describeOption)
}

/** Every offered move, sent at its largest count, and the reason any is refused. */
function refusedOffers(s: HydratedOathGameState, playerId = 'rhys'): string[] {
    return HydratedMoveWarbands.legalMoves(s, playerId).flatMap((option) => {
        const reason = HydratedMoveWarbands.reasonCannotMove(s, playerId, {
            move: option.move,
            owner: option.owner,
            count: option.max
        })
        return reason ? [`${describeOption(option)}: ${reason}`] : []
    })
}

function listedActions(s: HydratedOathGameState, playerId = 'rhys'): string[] {
    return new ActPhaseStateHandler().validActionsForPlayer(playerId, machineContext(s))
}

/** The player's own view as the table holds it: host-only and others' hidden values cannot be read. */
function ownView(s: HydratedOathGameState, playerId: string): HydratedOathGameState {
    const view: Visibility.Perspective = { kind: 'player', playerId }
    return OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)
}

describe('R-6.5 minor action: the Ring of Devotion’s holder is offered only the moves accepted', () => {
    for (const revision of REVISIONS) {
        it(`revision ${revision}: no move from the board to the site is offered, and the lift is`, () => {
            const s = table(revision, 2)
            expect(offered(s)).toEqual([`${WarbandMoveKind.SiteToBoard} rhys:1`])
            expect(refusedOffers(s)).toEqual([])
            expect(listedActions(s)).toContain(ActionType.MoveWarbands)
        })

        it(`revision ${revision}: with only a refused move, the Act Phase does not list the minor action`, () => {
            const s = table(revision, 1)
            // The move it would have been offered is the one refused.
            expect(
                HydratedMoveWarbands.reasonCannotMove(s, 'rhys', {
                    move: { kind: WarbandMoveKind.BoardToSite },
                    owner: 'rhys',
                    count: 1
                })
            ).toBe('you cannot place warbands at sites (Ring of Devotion)')
            expect(offered(s)).toEqual([])
            expect(HydratedMoveWarbands.canDoMoveWarbands(s, 'rhys')).toBe(false)
            expect(listedActions(s)).not.toContain(ActionType.MoveWarbands)
            expect(listedActions(s)).toContain(ActionType.EndActPhase)
        })

        it(`revision ${revision}: without the Ring both directions are offered, as before`, () => {
            const s = table(revision, 2, [])
            expect(offered(s)).toEqual([
                `${WarbandMoveKind.SiteToBoard} rhys:1`,
                `${WarbandMoveKind.BoardToSite} rhys:3`
            ])
            expect(refusedOffers(s)).toEqual([])
            expect(listedActions(table(revision, 1, []))).toContain(ActionType.MoveWarbands)
        })
    }

    it('the Ring changing hands moves the refusal with it', () => {
        const s = table(OathRevision.EngineFixes26, 1)
        expect(listedActions(s)).not.toContain(ActionType.MoveWarbands)

        s.getPlayerState('rhys').relicIds = []
        s.getPlayerState('dana').relicIds = [RING]
        expect(offered(s)).toEqual([`${WarbandMoveKind.BoardToSite} rhys:3`])
        expect(listedActions(s)).toContain(ActionType.MoveWarbands)

        // Dana, now holding it, cannot drop off at c2 and keeps the lift.
        s.getPlayerState('dana').warbandsOnBoard = { dana: 2 }
        openTurn(s, 'dana')
        expect(offered(s, 'dana')).toEqual([`${WarbandMoveKind.SiteToBoard} dana:1`])
        expect(refusedOffers(s, 'dana')).toEqual([])
    })

    it('with the Bandit Crown beside the Ring, the last warband may be lifted and nothing is dropped off', () => {
        const s = table(OathRevision.EngineFixes26, 1, [RING, BANDIT_CROWN])
        expect(offered(s)).toEqual([`${WarbandMoveKind.SiteToBoard} rhys:1`])
        expect(refusedOffers(s)).toEqual([])
        expect(listedActions(s)).toContain(ActionType.MoveWarbands)
    })

    it('a Citizen holding the Ring may lift the Empire’s warbands and give none to the site', () => {
        const s = testState(
            [
                testPlayer({
                    playerId: 'dana',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'c1',
                    warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }
                }),
                testPlayer({
                    playerId: 'rhys',
                    color: Color.Blue,
                    status: PlayerStatus.Citizen,
                    siteId: 'c1',
                    warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                    relicIds: [RING]
                })
            ],
            {
                oathRevision: OathRevision.EngineFixes26,
                warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 2 } }
            }
        )
        openTurn(s, 'rhys')
        // Moves between Imperial boards place nothing at a site and stay offered.
        expect(offered(s)).toEqual([
            `${WarbandMoveKind.SiteToBoard} ${IMPERIAL_WARBANDS}:1`,
            `${WarbandMoveKind.GiveToImperial} dana ${IMPERIAL_WARBANDS}:2`,
            `${WarbandMoveKind.TakeFromImperial} dana ${IMPERIAL_WARBANDS}:2`
        ])
        expect(refusedOffers(s)).toEqual([])

        // The Chancellor, without the Ring, still drops off at their site.
        openTurn(s, 'dana')
        expect(offered(s, 'dana')).toContain(
            `${WarbandMoveKind.BoardToSite} ${IMPERIAL_WARBANDS}:2`
        )
        expect(refusedOffers(s, 'dana')).toEqual([])
    })

    it("reads the same on Rhys's own view, and changes nothing there", () => {
        for (const atC1 of [1, 2]) {
            const s = table(OathRevision.EngineFixes26, atC1)
            const view = ownView(s, 'rhys')
            const before = JSON.stringify({
                board: view.getPlayerState('rhys').warbandsOnBoard,
                sites: view.warbandsBySite
            })
            expect(offered(view)).toEqual(offered(s))
            expect(refusedOffers(view)).toEqual([])
            expect(HydratedMoveWarbands.canDoMoveWarbands(view, 'rhys')).toBe(
                HydratedMoveWarbands.canDoMoveWarbands(s, 'rhys')
            )
            expect(listedActions(view)).toEqual(listedActions(s))
            expect(
                JSON.stringify({
                    board: view.getPlayerState('rhys').warbandsOnBoard,
                    sites: view.warbandsBySite
                })
            ).toBe(before)
        }
    })
})

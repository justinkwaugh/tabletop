import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { WarbandLocation } from '../model/campaign.js'
import { IMPERIAL_WARBANDS, WarbandOwner } from '../model/warbandCounts.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { addWarbandsToBoard, addWarbandsToSite, removeWarbandsFrom } from '../util/force.js'
import {
    banditsHoldSiteFor,
    isImperialPlayer,
    rulesSite,
    rulingWarbandOwners,
    warbandsFreeToLeave
} from '../util/rule.js'
import { ConsentRequestKind } from '../model/consent.js'
import { WarbandMove, WarbandMoveKind, type WarbandMoveOption } from '../model/warbandMove.js'
import { MachineState } from '../definition/states.js'
import { cannotPlaceWarbandsAtSites } from '../util/continuous.js'
import { countOf, describeWarbands } from '../util/warbands.js'
import { pawnSiteId } from '../util/pawn.js'

export type MoveWarbandsMetadata = Type.Static<typeof MoveWarbandsMetadata>
export const MoveWarbandsMetadata = Type.Object({
    owner: WarbandOwner,
    count: Type.Number(),
    from: WarbandLocation,
    to: WarbandLocation,
    /** R-6.5.a, R-6.5.b — nothing has moved yet. */
    awaitingConsentOf: Type.Optional(Type.String())
})

export type MoveWarbands = Type.Static<typeof MoveWarbands>
export const MoveWarbands = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveWarbands),
            playerId: Type.String(),
            move: WarbandMove,
            // R-6.6.2 can leave a player holding their own and the Empire's, so whose is input.
            owner: WarbandOwner,
            count: Type.Integer({ minimum: 0, maximum: 999 }),
            metadata: Type.Optional(MoveWarbandsMetadata)
        })
    ])
)

export const MoveWarbandsValidator = Compile(MoveWarbands)

export function isMoveWarbands(action?: GameAction): action is MoveWarbands {
    return action?.type === ActionType.MoveWarbands
}

export class HydratedMoveWarbands
    extends HydratableAction<typeof MoveWarbands>
    implements MoveWarbands
{
    declare type: ActionType.MoveWarbands
    declare playerId: string
    declare move: WarbandMove
    declare owner: WarbandOwner
    declare count: number
    declare metadata?: MoveWarbandsMetadata

    constructor(data: MoveWarbands) {
        super(data, MoveWarbandsValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedMoveWarbands.reasonCannotMove(state, this.playerId, this)
        if (reason) {
            throw Error(`Cannot move warbands: ${reason}`)
        }

        const { from, to } = HydratedMoveWarbands.endpoints(state, this.playerId, this.move)

        const consenterId = HydratedMoveWarbands.consenterFor(state, this.playerId, this.move)
        if (consenterId) {
            state.pendingConsent = {
                request: {
                    kind: ConsentRequestKind.WarbandMove,
                    move: this.move,
                    owner: this.owner,
                    count: this.count
                },
                askingPlayerId: this.playerId,
                askedPlayerId: consenterId,
                resumeMachineState: MachineState.ActPhase
            }
            this.metadata = {
                owner: this.owner,
                count: this.count,
                from,
                to,
                awaitingConsentOf: consenterId
            }
            return
        }

        HydratedMoveWarbands.carryOut(state, from, to, this.owner, this.count)
        this.metadata = { owner: this.owner, count: this.count, from, to }
    }

    /** R-6.5 */
    static carryOut(
        state: HydratedOathGameState,
        from: WarbandLocation,
        to: WarbandLocation,
        owner: WarbandOwner,
        count: number
    ) {
        removeWarbandsFrom(state, from, owner, count)
        if (to.kind === 'site') {
            addWarbandsToSite(state, to.siteId, owner, count)
        } else {
            addWarbandsToBoard(state, to.playerId, owner, count)
        }
    }

    static endpoints(
        state: HydratedOathGameState,
        playerId: string,
        move: WarbandMove
    ): { from: WarbandLocation; to: WarbandLocation } {
        switch (move.kind) {
            case WarbandMoveKind.SiteToBoard:
                return {
                    from: { kind: 'site', siteId: pawnSiteId(state, playerId) },
                    to: { kind: 'board', playerId }
                }
            case WarbandMoveKind.BoardToSite:
                return {
                    from: { kind: 'board', playerId },
                    to: { kind: 'site', siteId: pawnSiteId(state, playerId) }
                }
            case WarbandMoveKind.GiveToImperial:
                return {
                    from: { kind: 'board', playerId },
                    to: { kind: 'board', playerId: move.otherPlayerId }
                }
            case WarbandMoveKind.TakeFromImperial:
                return {
                    from: { kind: 'board', playerId: move.otherPlayerId },
                    to: { kind: 'board', playerId }
                }
        }
    }

    static maxMovable(
        state: HydratedOathGameState,
        playerId: string,
        move: WarbandMove,
        owner: WarbandOwner
    ): number {
        const player = state.getPlayerState(playerId)

        switch (move.kind) {
            case WarbandMoveKind.SiteToBoard: {
                // R-6.5: "except the last one".
                return warbandsFreeToLeave(state, playerId, pawnSiteId(state, playerId), owner)
            }
            case WarbandMoveKind.BoardToSite:
            case WarbandMoveKind.GiveToImperial:
                return countOf(player.warbandsOnBoard, owner)
            case WarbandMoveKind.TakeFromImperial:
                return countOf(state.getPlayerState(move.otherPlayerId).warbandsOnBoard, owner)
        }
    }

    static reasonCannotMove(
        state: HydratedOathGameState,
        playerId: string,
        choice: Pick<MoveWarbands, 'move' | 'owner' | 'count'>
    ): string | undefined {
        if (!Number.isInteger(choice.count) || choice.count < 1) {
            return `must move at least one warband, not ${choice.count}`
        }

        const shape = HydratedMoveWarbands.reasonMoveShapeInvalid(state, playerId, choice.move)
        if (shape) return shape

        // R-7.1.4-H1 Ring of Devotion: "cannot place warbands at sites".
        if (
            choice.move.kind === WarbandMoveKind.BoardToSite &&
            cannotPlaceWarbandsAtSites(state, playerId)
        ) {
            return 'you cannot place warbands at sites (Ring of Devotion)'
        }

        const owned = HydratedMoveWarbands.movableOwnersFor(state, playerId, choice.move)
        if (!owned.includes(choice.owner)) {
            const whose =
                choice.move.kind === WarbandMoveKind.TakeFromImperial
                    ? `${choice.move.otherPlayerId}'s`
                    : 'yours'
            return `${choice.owner}'s warbands are not ${whose} to move (${owned.join(', ')})`
        }

        const max = HydratedMoveWarbands.maxMovable(state, playerId, choice.move, choice.owner)
        if (choice.count > max) {
            const lastMustStay =
                choice.move.kind === WarbandMoveKind.SiteToBoard &&
                !banditsHoldSiteFor(state, playerId, pawnSiteId(state, playerId))
            const limit = lastMustStay
                ? `${max} (the last one must stay to keep rule of the site)`
                : `${max}`
            return `cannot move ${describeWarbands(choice.count, choice.owner)}: at most ${limit}`
        }

        return undefined
    }

    static legalMoves(state: HydratedOathGameState, playerId: string): WarbandMoveOption[] {
        const moves: WarbandMove[] = [
            { kind: WarbandMoveKind.SiteToBoard },
            { kind: WarbandMoveKind.BoardToSite },
            ...state.players
                .filter((other) => other.playerId !== playerId)
                .flatMap((other): WarbandMove[] => [
                    { kind: WarbandMoveKind.GiveToImperial, otherPlayerId: other.playerId },
                    { kind: WarbandMoveKind.TakeFromImperial, otherPlayerId: other.playerId }
                ])
        ]

        const results: WarbandMoveOption[] = []
        for (const move of moves) {
            if (HydratedMoveWarbands.reasonMoveShapeInvalid(state, playerId, move)) {
                continue
            }
            for (const owner of HydratedMoveWarbands.movableOwnersFor(state, playerId, move)) {
                const max = HydratedMoveWarbands.maxMovable(state, playerId, move, owner)
                if (max > 0) {
                    results.push({ move, owner, max })
                }
            }
        }
        return results
    }

    static canDoMoveWarbands(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedMoveWarbands.legalMoves(state, playerId).length > 0
    }

    private static movableOwnersFor(
        state: HydratedOathGameState,
        playerId: string,
        move: WarbandMove
    ): WarbandOwner[] {
        const holderId =
            move.kind === WarbandMoveKind.TakeFromImperial ? move.otherPlayerId : playerId
        return rulingWarbandOwners(state, holderId)
    }

    private static reasonMoveShapeInvalid(
        state: HydratedOathGameState,
        playerId: string,
        move: WarbandMove
    ): string | undefined {
        if (
            move.kind === WarbandMoveKind.SiteToBoard ||
            move.kind === WarbandMoveKind.BoardToSite
        ) {
            const siteId = pawnSiteId(state, playerId)
            // R-6.5: only the board-to-site direction requires ruling the site.
            if (move.kind === WarbandMoveKind.BoardToSite && !rulesSite(state, playerId, siteId)) {
                return `you do not rule ${siteId}, so you cannot move warbands onto it`
            }
            return undefined
        }

        // R-6.5.b
        const other = state.findPlayerState(move.otherPlayerId)
        if (!other) return `no such player ${move.otherPlayerId}`
        if (other.playerId === playerId) {
            return 'cannot give warbands to or take them from yourself'
        }
        if (!isImperialPlayer(state, playerId)) {
            return 'only an Imperial player can give warbands to or take them from another'
        }
        if (!isImperialPlayer(state, other.playerId)) {
            return `${other.playerId} is not an Imperial player`
        }
        if (pawnSiteId(state, other.playerId) !== pawnSiteId(state, playerId)) {
            return `${other.playerId}'s pawn is not at your site`
        }
        return undefined
    }

    /** R-6.5.a, R-6.5.b */
    static consenterFor(
        state: HydratedOathGameState,
        playerId: string,
        move: WarbandMove
    ): string | undefined {
        switch (move.kind) {
            case WarbandMoveKind.SiteToBoard:
                return state.getPlayerState(playerId).status === PlayerStatus.Citizen
                    ? state.warbandBankHolderOf(IMPERIAL_WARBANDS)
                    : undefined
            case WarbandMoveKind.BoardToSite:
                return undefined
            case WarbandMoveKind.GiveToImperial:
            case WarbandMoveKind.TakeFromImperial:
                return move.otherPlayerId
        }
    }
}

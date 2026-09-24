import type { StationRules } from '../stations/stationPlacement.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type HydratedAction,
    type GameAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import type { TrackRules } from '../construction/trackConstruction.js'
import { privateTrackConstruction, type PrivatePowerRules } from './privatePowers.js'
import { HydratedLayPrivateTile } from './layPrivateTile.js'
import type { CompanyDecisionState } from './companyDecision.js'
export const ContinueOperatingRound = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ContinueOperatingRound'),
        companyId: Type.String()
    },
    { additionalProperties: false }
)
export type ContinueOperatingRound = Type.Static<typeof ContinueOperatingRound>
const Validator = Compile(ContinueOperatingRound)
export class HydratedContinueOperatingRound
    extends HydratableAction<typeof ContinueOperatingRound>
    implements ContinueOperatingRound
{
    declare type: 'ContinueOperatingRound'
    declare playerId: string
    declare companyId: string
    constructor(data: ContinueOperatingRound) {
        super(data instanceof HydratedContinueOperatingRound ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & CompanyDecisionState): void {
        assert(
            this.source === ActionSource.User &&
                state.machineState === 'OperatingSet' &&
                state.privatePowerWindow?.companyId === this.companyId &&
                state.activePlayerIds.includes(this.playerId) &&
                !state.privatePowerWindow.passedPlayerIds.includes(this.playerId),
            'Only the deciding private owner may continue operation'
        )
        state.privatePowerWindow.passedPlayerIds.push(this.playerId)
    }
}
export class BetweenCompaniesHandler<
    State extends HydratedGameState & CompanyDecisionState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly powers: PrivatePowerRules,
        private readonly track: TrackRules,
        private readonly stations: StationRules
    ) {}
    private nextPlayer(state: State): string | undefined {
        if (
            !state.operatingSet?.privateIncomePaid ||
            this.stations.pendingHomes(state).length ||
            !nextOperatingCompany(state)
        )
            return undefined
        return state.players.find(
            (player) =>
                !state.privatePowerWindow?.passedPlayerIds.includes(player.playerId) &&
                state.companies.some((company) => {
                    if (
                        company.kind !== 'private' ||
                        company.closed ||
                        state.usedPrivatePowerIds.includes(company.id)
                    )
                        return false
                    const terms = this.powers.trackTerms(state, company.id, player.playerId)
                    return (
                        terms &&
                        terms.locationIds.some(
                            (id) =>
                                privateTrackConstruction(state, terms, this.track).choices(id)
                                    .length
                        )
                    )
                })
        )?.playerId
    }
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const playerId = this.nextPlayer(context.gameState)
        if (!playerId) return this.handler.isValidAction(action, context)
        return (
            action.source === ActionSource.User &&
            action.playerId === playerId &&
            (action instanceof HydratedLayPrivateTile
                ? action.isValid(context.gameState)
                : action instanceof HydratedContinueOperatingRound &&
                  action.companyId === nextOperatingCompany(context.gameState))
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        return playerId === this.nextPlayer(context.gameState)
            ? ['LayPrivateTile', 'ContinueOperatingRound']
            : this.handler.validActionsForPlayer(playerId, context)
    }
    enter(context: MachineContext<State>): void {
        const playerId = this.nextPlayer(context.gameState)
        if (playerId) {
            context.gameState.privatePowerWindow ??= {
                companyId: nextOperatingCompany(context.gameState)!,
                passedPlayerIds: []
            }
            context.gameState.activePlayerIds = [playerId]
        } else {
            this.handler.enter(context)
        }
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        if (action.type === 'StartOperatingTurn') delete context.gameState.privatePowerWindow
        return action instanceof HydratedLayPrivateTile ||
            action instanceof HydratedContinueOperatingRound
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}

export function isContinueOperatingRound(action: GameAction): action is ContinueOperatingRound {
    return (
        action instanceof HydratedContinueOperatingRound ||
        (action.type === 'ContinueOperatingRound' && Validator.Check(action))
    )
}

import { ActionSource, PlayerStatus, assertExists, type GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { RailheadsRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { HexKind, isLayTrackSpace, type CompanyId, type LayTrackSpace } from '../editions/types.js'
import { HydratedRailheadsGameState } from '../model/gameState.js'
import { IndustryBoost, PlacementKind, type Placement } from '../model/track.js'

export function createGame(count: number, config: Record<string, boolean | string> = {}) {
    return RailheadsRuntime.initializer.initializeGame(
        {
            id: 'railheads-playthrough',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 11,
            config,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function act<T extends GameAction>(action: T): GameAction {
    return action
}

// Lays as many pieces as the action allows, each where the board, as built so far, permits.
export function botPlacements(
    state: HydratedRailheadsGameState,
    playerId: string,
    space: LayTrackSpace,
    step: number
): Placement[] {
    const preview = new HydratedRailheadsGameState(structuredClone(state.dehydrate()))
    const rules = preview.layTrackRules(space)
    const companies = preview
        .buildableCompanies(playerId, space)
        .toSorted((a, b) => preview.company(b).treasury - preview.company(a).treasury)
        .slice(0, rules.maxCompanies)
    const placements: Placement[] = []
    for (const companyId of companies) {
        for (let count = 0; count < rules.placementsPerCompany; count++) {
            const placement = nextPlacement(preview, playerId, space, companyId, step + count)
            if (!placement) break
            preview.placeTrack(playerId, space, placement)
            placements.push(placement)
        }
    }
    return placements
}

function nextPlacement(
    state: HydratedRailheadsGameState,
    playerId: string,
    space: LayTrackSpace,
    companyId: CompanyId,
    step: number
): Placement | undefined {
    const targets = state.placementTargets(playerId, space, companyId)
    const sites = targets.filter(
        (target) => state.edition.map.hex(target.coords).kind !== HexKind.Countryside
    )
    const target = sites[0] ?? targets[step % Math.max(1, targets.length)]
    if (!target) return undefined
    const boost =
        target.kind === PlacementKind.Disc && state.needsBoostChoice(target.coords)
            ? step % 2 === 0
                ? IndustryBoost.Revenue
                : IndustryBoost.Development
            : undefined
    return {
        companyId,
        coords: target.coords,
        kind: target.kind,
        ...(boost ? { boost } : {})
    }
}

export function botAction(
    state: HydratedRailheadsGameState,
    playerId: string,
    step: number
): GameAction {
    const base = { id: `a${step}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const cash = state.getPlayerState(playerId).cash
    switch (state.machineState) {
        case MachineState.ShareBidding: {
            const amount = state.smallestBid()
            if (
                state.bidding().currentBidderId === playerId &&
                amount <= Math.min(cash, 4 + (step % 9))
            ) {
                return act({ ...base, type: ActionType.PlaceBid, amount })
            }
            return act({ ...base, type: ActionType.PassBid })
        }
        case MachineState.ChoosingAction: {
            const spaces = state.availableSpaces(playerId)
            const consolidatable = state.consolidatableSpaces()
            if (consolidatable.length > 0 && (spaces.length === 0 || step % 5 === 0)) {
                const space = consolidatable.toSorted(
                    (a, b) => state.spaceCoins(b) - state.spaceCoins(a)
                )[0]
                return act({ ...base, type: ActionType.Consolidate, space })
            }
            const space = spaces[step % spaces.length]
            return act({ ...base, type: ActionType.ChooseAction, space })
        }
        case MachineState.IssuingShare: {
            const [companyId] = state.issuableCompanies(playerId)
            return act({
                ...base,
                type: ActionType.IssueShare,
                companyId,
                amount: state.minimumBid(companyId)
            })
        }
        case MachineState.ChoosingIndustry: {
            const industries = state.investableIndustries(playerId)
            return act({
                ...base,
                type: ActionType.InvestInIndustry,
                industry: industries[step % industries.length]
            })
        }
        case MachineState.SealedBidding: {
            const auction = state.industryAuction
            assertExists(auction, 'An industry auction is open')
            const raise = Math.min(cash, auction.minimum + (step % 4))
            const amount =
                playerId !== auction.investorId && step % 3 === 0
                    ? 0
                    : Math.max(raise, auction.minimum)
            return act({ ...base, type: ActionType.PlaceSealedBid, amount })
        }
        case MachineState.LayingTrack: {
            const space = state.activeSpace
            assertExists(space, 'A Lay Track action is being taken')
            if (!isLayTrackSpace(space)) throw Error(`${space} lays no track`)
            return act({
                ...base,
                type: ActionType.LayTrack,
                placements: botPlacements(state, playerId, space, step)
            })
        }
        default:
            throw Error(`No bot move in ${state.machineState}`)
    }
}

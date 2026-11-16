import {
    EighteenXXTransferTiming,
    closePrivate,
    controllingOwner,
    markTurn,
    nextOperatingCompany,
    privateOwner,
    privatePowerUsed,
    type CompanyDecisionState,
    type PrivatePowerRules
} from '@tabletop/18xx'
import { CoastalCityLocationIds, PortLocationIds } from './map.js'
import { MarittimaPrivateId, NavalePrivateId } from './privates.js'
import { MarittimaTurnMark } from './stations.js'
import { requireState1849 } from './state.js'
import { TileSet1849 } from './tiles.js'

/** The corporation operating now, if the player controls it and it owns the private. */
function owningOperatingCompany(
    state: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string
): string | undefined {
    const owner = privateOwner(state, privateCompanyId)
    const companyId = EighteenXXTransferTiming.operatingCompany(state)
    return owner?.kind === 'company' &&
        owner.companyId === companyId &&
        controllingOwner(state, companyId)?.playerId === playerId &&
        !privatePowerUsed(state, privateCompanyId)
        ? companyId
        : undefined
}

export const PortMarkerKind = 'port'

// The CNM's owner closes it to put the +L. 20 token on a port, in its own turn (§7.1). The SMS's
// owner closes it in place of its tile and token steps, to lay or upgrade a tile in a coastal
// city it need not reach, then place a station there (§7.1, §10.4).
export const PrivatePowerRules1849: PrivatePowerRules = {
    trackTerms(state, privateCompanyId, playerId) {
        if (privateCompanyId !== MarittimaPrivateId) return undefined
        const companyId = owningOperatingCompany(state, privateCompanyId, playerId)
        if (
            !companyId ||
            state.machineState !== 'LayingTrack' ||
            state.trackStep?.companyId !== companyId ||
            state.trackStep.lays.length > 0 ||
            requireState1849(state).stationStep?.placedStationIds.length
        )
            return undefined
        return {
            companyId,
            locationIds: CoastalCityLocationIds,
            definitionIds: TileSet1849.definitions.map((definition) => definition.id),
            payer: { kind: 'company', companyId },
            connected: false,
            countsAsOrdinaryLay: true
        }
    },
    stationPrivateIds: [MarittimaPrivateId],
    afterTrackLay(stateObject, privateCompanyId, details) {
        if (privateCompanyId !== MarittimaPrivateId) return { payments: [], closedPrivateIds: [] }
        // In place of its tile and token steps, so it places no other station that turn (§7.1).
        const state = requireState1849(stateObject)
        if (nextOperatingCompany(state) === details.companyId) markTurn(state, MarittimaTurnMark)
        return { payments: [], closedPrivateIds: [privateCompanyId] }
    },
    earlyTrainCompany: () => undefined,
    markerTerms(state, privateCompanyId, playerId) {
        if (privateCompanyId !== NavalePrivateId) return undefined
        return owningOperatingCompany(state, privateCompanyId, playerId)
            ? { kind: PortMarkerKind, locationIds: PortLocationIds }
            : undefined
    },
    afterMarker(stateObject, privateCompanyId, locationId) {
        const state = requireState1849(stateObject)
        const owner = privateOwner(state, privateCompanyId)
        if (privateCompanyId !== NavalePrivateId || owner?.kind !== 'company') return
        state.portBonus = { companyId: owner.companyId, locationId }
        closePrivate(state, privateCompanyId)
    }
}

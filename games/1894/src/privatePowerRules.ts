import {
    RailwayMapState,
    controllingOwner,
    privateOwningCompany,
    privatePowerUsed,
    type CompanyDecisionState,
    type PrivatePowerRules,
    type PrivateTrackTerms,
    type TrackRequest
} from '@tabletop/18xx'
import { EighteenNinetyFourTrackRules } from './trackRules.js'
import { inFinalOperatingSet } from './endingRules.js'
import { londonShippingTokenTerms } from './london.js'
import { EighteenNinetyFourMap } from './map.js'
import { ReimsCharlevillePrivateId } from './privates.js'
import { EighteenNinetyFourTileSet } from './tiles.js'

const YellowTileIds = EighteenNinetyFourTileSet.definitions
    .filter((tile) => tile.face.color === 'yellow')
    .map((tile) => tile.id)

/** Gare de Liège and Station Antwerpen: their hex and the tiles they lay or upgrade to. */
const StationLays: Readonly<Record<string, string>> = { GLG: 'H17', SAC: 'D17' }
const StationLayTileIds = ['18xx:57', '18xx:14', '18xx:15', '18xx:619']

/** The company owning the private, while it is building track in its own turn. */
function buildingOwner(
    state: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string
): string | undefined {
    const companyId = state.trackStep?.companyId
    return companyId &&
        state.machineState === 'LayingTrack' &&
        !state.trackStep?.completed &&
        !inFinalOperatingSet(state) &&
        privateOwningCompany(state, privateCompanyId) === companyId &&
        controllingOwner(state, companyId)?.playerId === playerId
        ? companyId
        : undefined
}

function trackTerms(
    state: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string
): PrivateTrackTerms | undefined {
    const companyId = buildingOwner(state, privateCompanyId, playerId)
    if (!companyId) return undefined
    const payer = { kind: 'company' as const, companyId }
    // A private's lay keeps 1894's own limits: blocked hexes, no upgrade of a tile laid this
    // round, and Paris's marked city (§7.3.3, §11.2.2.3–4, §12.2).
    const restriction = (request: TrackRequest) =>
        EighteenNinetyFourTrackRules.restriction(state, request)
    // Once per game, an extra yellow tile for F60 besides the company's track actions, which it
    // may not upgrade the same round (§11.2.2.1).
    if (privateCompanyId === ReimsCharlevillePrivateId)
        return privatePowerUsed(state, privateCompanyId)
            ? undefined
            : {
                  companyId,
                  locationIds: EighteenNinetyFourMap.definition.locations
                      .filter((location) => location.buildable)
                      .map((location) => location.id),
                  definitionIds: YellowTileIds,
                  payer,
                  connected: true,
                  layFee: 60,
                  recordsLay: true,
                  restriction
              }
    // A yellow tile or its upgrade in Liège or Antwerpen as one of the company's track actions,
    // without a connection, then a free station there (§11.2.2.3–4).
    const locationId = StationLays[privateCompanyId]
    if (!locationId) return undefined
    const color = new RailwayMapState(
        EighteenNinetyFourMap,
        EighteenNinetyFourTileSet,
        state.tileInventory
    ).tile(locationId).face.color
    return color === 'white' || color === 'yellow'
        ? {
              companyId,
              locationIds: [locationId],
              definitionIds: StationLayTileIds,
              payer,
              connected: false,
              countsAsOrdinaryLay: true,
              reusable: true,
              restriction
          }
        : undefined
}

export const EighteenNinetyFourPrivatePowerRules: PrivatePowerRules = {
    trackTerms,
    earlyTrainCompany: () => undefined,
    stationPrivateIds: Object.keys(StationLays),
    tokenTerms: londonShippingTokenTerms
}

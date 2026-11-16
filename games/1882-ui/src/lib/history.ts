import {
    ScId,
    ScrId,
    isConvertCentral,
    isMoveRebellionStation,
    isNorthWestRebellion,
    Market1882
} from '@tabletop/1882'
import {
    joinDetails,
    type HistoryDescription,
    type MoneyFormat,
    type TitleHistoryNames
} from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'

/** 1882's own history rows: the SC's exchange, a station's move and the rebellion. */
export function describe1882Action(
    action: GameAction,
    { companyName, place }: TitleHistoryNames,
    money: MoneyFormat
): HistoryDescription | undefined {
    if (isConvertCentral(action)) {
        const details = action.metadata
        const par = Market1882.space(action.marketSpaceId).price
        return {
            text: `Exchanged ${companyName(ScId)} for the ${companyName(ScrId)} president’s certificate`,
            value: money(par),
            companyToken: ScrId,
            important: true,
            detail: joinDetails(
                `home ${place(action.home.locationId)}`,
                details?.replacedStationId ? 'neutral station removed' : undefined,
                details?.extraTrainId ? 'an extra train joined the bank' : undefined
            )
        }
    }
    if (isMoveRebellionStation(action)) {
        const details = action.metadata
        return {
            text: details
                ? `${companyName(details.companyId)} moved its station from ${place(details.from.locationId)} to ${place(details.to.locationId)}`
                : `Moved a station to ${place(action.position.locationId)}`,
            detail: joinDetails(
                details?.neutralStationId ? 'a neutral station took the home' : undefined,
                details?.noLay ? 'no tile could be laid there' : undefined
            )
        }
    }
    if (isNorthWestRebellion(action)) {
        const removed = action.metadata?.removed ?? []
        return {
            text: 'The North-West Rebellion',
            important: true,
            omitActor: true,
            detail: removed.length
                ? `removed the yellow tiles in ${removed.map((tile) => place(tile.locationId)).join(', ')}`
                : 'found no yellow tiles to remove'
        }
    }
    return undefined
}

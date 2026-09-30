import { assertExists } from '@tabletop/common'
import type { CampaignState } from '../model/campaign.js'

export function required<T>(value: T, what: string): NonNullable<T> {
    assertExists(value, `${what} is missing`)
    return value
}

export function ongoingCampaign(state: { campaign?: CampaignState }): CampaignState {
    return required(state.campaign, 'the Campaign under way')
}

import { ActionType } from '@tabletop/oath'

export function campaignDraftOpens(
    chosen: ActionType | undefined,
    validActionTypes: readonly string[]
): boolean {
    return chosen === ActionType.Campaign && validActionTypes.includes(ActionType.Campaign)
}

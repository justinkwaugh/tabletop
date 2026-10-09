import { ActionSpace } from '@tabletop/hill-country-grocers'

export const ACTION_RULES: Record<Exclude<ActionSpace, ActionSpace.AuctionShare>, string> = {
    [ActionSpace.BuildNetwork]: 'Cost per store: $2 to the bank, $1 to each grocer already there.',
    [ActionSpace.DevelopTowns]: 'Balcones +$1 value. Each grocer there +$2 value and $1 cash.'
}

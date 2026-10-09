import { ActionSpace } from '@tabletop/hill-country-grocers'

export const ACTION_RULES: Record<ActionSpace, string> = {
    [ActionSpace.BuildNetwork]: 'Cost per store: $2 to the bank, $1 to each grocer already there.',
    [ActionSpace.DevelopTowns]:
        'Place a development in two different cities, or place one and take $1 from the bank.',
    [ActionSpace.AuctionShare]:
        'Auction any company’s share. Open at any price, even $0; the winning bid goes to the company.'
}

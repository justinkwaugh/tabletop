import { ActionSpace } from '@tabletop/hill-country-grocers'

export const ACTION_RULES: Record<ActionSpace, string> = {
    [ActionSpace.BuildNetwork]:
        'Place 1–2 of a grocer’s stores next to its existing stores. For each store, the company pays $2 to the bank and $1 to each grocer already there. Max 2 stores per hex; black cities unlimited.',
    [ActionSpace.DevelopTowns]:
        'Place a development in two different cities, or place one and take $1 from the bank.',
    [ActionSpace.AuctionShare]:
        'Auction any company’s share. Open at any price, even $0; the winning bid goes to the company.'
}

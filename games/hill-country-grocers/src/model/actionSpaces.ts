export enum ActionSpace {
    BuildNetwork = 'BuildNetwork',
    DevelopTowns = 'DevelopTowns',
    AuctionShare = 'AuctionShare'
}

export const ACTION_SPACES: readonly ActionSpace[] = [
    ActionSpace.BuildNetwork,
    ActionSpace.DevelopTowns,
    ActionSpace.AuctionShare
]

export const ACTIONS_PER_ROUND = 11

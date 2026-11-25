import type { FollowEligibility } from '@tabletop/common'

export interface GameFollow {
    userId: string
    gameId: string
}

export type GameFollowAddition =
    | 'added'
    | 'alreadyFollowing'
    | 'limitReached'
    | 'gameNotFound'
    | 'notFollowable'
    | 'accountUnavailable'

export type FollowEligibilityCheck = (game: FollowEligibility) => boolean

export interface GameFollowStore {
    addFollow(
        follow: GameFollow & { limit: number; eligible: FollowEligibilityCheck }
    ): Promise<GameFollowAddition>
    removeFollow(follow: GameFollow): Promise<void>
    removeIneligibleFollows(prune: {
        userId: string
        gameIds: string[]
        eligible: FollowEligibilityCheck
    }): Promise<void>
    findFollowedGameIds(userId: string): Promise<string[]>
    findFollowerIds(gameId: string): Promise<string[]>
    deleteFollowsForUser(userId: string): Promise<void>
    deleteFollowsForGame(gameId: string): Promise<void>
}

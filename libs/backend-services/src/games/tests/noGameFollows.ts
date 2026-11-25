import type { GameFollowStore } from '../../persistence/stores/gameFollowStore.js'

export const noGameFollows: Pick<
    GameFollowStore,
    'findFollowerIds' | 'removeFollow' | 'deleteFollowsForGame'
> = {
    findFollowerIds: async () => [],
    removeFollow: async () => undefined,
    deleteFollowsForGame: async () => undefined
}

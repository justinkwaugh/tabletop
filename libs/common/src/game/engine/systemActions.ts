import { HydratedResetPrng, isResetPrng } from '../actions/resetPrng.js'
import { GameAction, HydratedAction } from './gameAction.js'

export enum SystemActionType {
    ResetPrng = '__resetPrng__'
}

export function isSystemAction(action: GameAction): boolean {
    return action.type == SystemActionType.ResetPrng
}

export function hydrateSystemAction(data: GameAction): HydratedAction {
    switch (true) {
        case isResetPrng(data): {
            return new HydratedResetPrng(data)
        }
        default: {
            throw new Error(`Unknown system action type ${data.type}`)
        }
    }
}

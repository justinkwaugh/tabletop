import {
    GameAction,
    type GameHydrator,
    GameState,
    type HydratedAction,
    type HydratedGameState
} from '@tabletop/common'
import { SolGameState, HydratedSolGameState } from '../model/gameState.js'
import { HydratedLaunch, isLaunch } from '../actions/launch.js'
import { HydratedFly, isFly } from '../actions/fly.js'
import { HydratedConvert, isConvert } from '../actions/convert.js'
import { HydratedActivate, isActivate } from '../actions/activate.js'
import { HydratedActivateBonus, isActivateBonus } from '../actions/activateBonus.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedDrawCards, isDrawCards } from '../actions/drawCards.js'
import { HydratedChooseCard, isChooseCard } from '../actions/chooseCard.js'
import { HydratedSolarFlare, isSolarFlare } from '../actions/solarFlare.js'
import { HydratedHurl, isHurl } from '../actions/hurl.js'
import { HydratedActivateEffect, isActivateEffect } from '../actions/activateEffect.js'
import { HydratedChooseMove, isChooseMove } from '../actions/chooseMove.js'
import { HydratedChooseConvert, isChooseConvert } from '../actions/chooseConvert.js'
import { HydratedChooseActivate, isChooseActivate } from '../actions/chooseActivate.js'
import { HydratedInvade, isInvade } from '../actions/invade.js'
import { HydratedSacrifice, isSacrifice } from '../actions/sacrifice.js'
import { HydratedHatch, isHatch } from '../actions/hatch.js'
import { HydratedBlight, isBlight } from '../actions/blight.js'
import { HydratedAccelerate, isAccelerate } from '../actions/accelerate.js'
import { HydratedFuel, isFuel } from '../actions/fuel.js'

export class SolHydrator implements GameHydrator {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isChooseMove(data): {
                return new HydratedChooseMove(data)
            }
            case isChooseConvert(data): {
                return new HydratedChooseConvert(data)
            }
            case isChooseActivate(data): {
                return new HydratedChooseActivate(data)
            }
            case isLaunch(data): {
                return new HydratedLaunch(data)
            }
            case isFly(data): {
                return new HydratedFly(data)
            }
            case isHurl(data): {
                return new HydratedHurl(data)
            }
            case isConvert(data): {
                return new HydratedConvert(data)
            }
            case isActivate(data): {
                return new HydratedActivate(data)
            }
            case isActivateBonus(data): {
                return new HydratedActivateBonus(data)
            }
            case isPass(data): {
                return new HydratedPass(data)
            }
            case isDrawCards(data): {
                return new HydratedDrawCards(data)
            }
            case isChooseCard(data): {
                return new HydratedChooseCard(data)
            }
            case isSolarFlare(data): {
                return new HydratedSolarFlare(data)
            }
            case isActivateEffect(data): {
                return new HydratedActivateEffect(data)
            }
            case isInvade(data): {
                return new HydratedInvade(data)
            }
            case isSacrifice(data): {
                return new HydratedSacrifice(data)
            }
            case isHatch(data): {
                return new HydratedHatch(data)
            }
            case isBlight(data): {
                return new HydratedBlight(data)
            }
            case isAccelerate(data): {
                return new HydratedAccelerate(data)
            }
            case isFuel(data): {
                return new HydratedFuel(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: GameState): HydratedGameState {
        return new HydratedSolGameState(state as SolGameState)
    }
}

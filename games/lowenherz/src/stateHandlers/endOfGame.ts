import { GameResult, type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { PoliticsCardType } from '../definition/politicsCards.js'

// The King is Dead card already awarded hill power points before transitioning here
// (see StartOfTurnStateHandler) - all that's left is applying held Parchment cards and
// declaring a winner. Per the rulebook: "the new king (and winner) is the player whose
// power marker has moved the farthest... in case of a tie, the player (among those
// tied) with the most ducats wins (treasure cards are included)." Treasure cards
// aren't playable yet, so the ducat tiebreaker only counts plain money for now - a
// true tie survives as multiple winningPlayerIds/GameResult.Draw, matching every
// other game in this repo's end-of-game convention.
export class EndOfGameStateHandler
    implements MachineStateHandler<HydratedAction, HydratedLowenherzGameState>
{
    isValidAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedLowenherzGameState>
    ): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedLowenherzGameState>
    ): string[] {
        return []
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const state = context.gameState
        state.activePlayerIds = []

        // "These cards are saved and used at the end of the game. Their owners move
        // their power markers forward the number of spaces stated on the cards." -
        // Parchment is never "played" during the game, it just always counts here.
        for (const player of state.players) {
            const parchmentBonus = player.politicsCards
                .filter((c) => c.type === PoliticsCardType.Parchment)
                .reduce((sum, c) => sum + (c.value ?? 0), 0)
            player.powerPoints += parchmentBonus
        }

        const maxPowerPoints = Math.max(...state.players.map((p) => p.powerPoints))
        const powerPointLeaders = state.players.filter((p) => p.powerPoints === maxPowerPoints)

        const maxMoney = Math.max(...powerPointLeaders.map((p) => p.money))
        const winners = powerPointLeaders.filter((p) => p.money === maxMoney)

        state.winningPlayerIds = winners.map((p) => p.playerId)
        state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
    }

    onAction(
        _action: HydratedAction,
        _context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        throw new Error('EndOfGame does not handle actions')
    }
}

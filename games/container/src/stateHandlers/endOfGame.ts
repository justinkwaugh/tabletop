import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { GameResult } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedContainerGameState } from '../model/gameState.js'
import { CONTAINER_COLORS } from '../definition/constants.js'
import { ContainerColor } from '../model/container.js'

export class EndOfGameStateHandler implements MachineStateHandler<HydratedAction> {
    isValidAction(): boolean {
        return false
    }

    validActionsForPlayer(): never[] {
        return []
    }

    enter(context: MachineContext): void {
        const state = context.gameState as HydratedContainerGameState
        const bank = state.investmentBank
        if (bank?.paymentCard) {
            state.resolveBrokerAuction(bank.paymentCard.bidderId)
        }
        const scores = new Map<string, number>()
        const factoryCounts = new Map<string, number>()

        for (const player of state.players) {
            const counts: Record<ContainerColor, number> = {
                [ContainerColor.Purple]: 0,
                [ContainerColor.Brown]: 0,
                [ContainerColor.Blue]: 0,
                [ContainerColor.Red]: 0,
                [ContainerColor.Green]: 0
            }

            for (const container of player.island) {
                counts[container] += 1
            }

            const hasAllColors = CONTAINER_COLORS.every((color) => counts[color] > 0)
            const specialValue = hasAllColors
                ? player.valueCard.specialValueIfComplete
                : player.valueCard.specialValueIfIncomplete

            const maxCount = Math.max(...Object.values(counts))
            const tiedColors = CONTAINER_COLORS.filter((color) => counts[color] === maxCount)

            let discardColor = tiedColors[0]
            if (tiedColors.length > 1 && tiedColors.includes(player.valueCard.specialColor)) {
                discardColor = player.valueCard.specialColor
            } else if (tiedColors.length > 1) {
                discardColor = tiedColors.reduce((lowest, color) => {
                    const lowestValue =
                        lowest === player.valueCard.specialColor
                            ? specialValue
                            : player.valueCard.values[lowest]
                    const currentValue =
                        color === player.valueCard.specialColor
                            ? specialValue
                            : player.valueCard.values[color]
                    return currentValue < lowestValue ? color : lowest
                }, tiedColors[0])
            }

            let islandValue = 0
            for (const color of CONTAINER_COLORS) {
                if (color === discardColor) {
                    continue
                }
                const value =
                    color === player.valueCard.specialColor
                        ? specialValue
                        : player.valueCard.values[color]
                islandValue += value * counts[color]
            }

            const harborValue = player.harborStore.length * 2
            const investmentHarborValue =
                (bank?.personalHarbors[player.playerId]?.length ?? 0) * 3
            const shipValue = player.ship.cargo.length * 3
            const loanPenalty = player.loans * 11

            const totalScore =
                player.money +
                islandValue +
                harborValue +
                investmentHarborValue +
                shipValue -
                loanPenalty
            player.score = totalScore
            scores.set(player.playerId, totalScore)
            factoryCounts.set(player.playerId, player.factoryStore.length)
        }

        const highestScore = Math.max(...scores.values())
        const topPlayers = Array.from(scores.entries())
            .filter(([, score]) => score === highestScore)
            .map(([playerId]) => playerId)

        let winners = topPlayers
        if (topPlayers.length > 1) {
            const maxFactory = Math.max(
                ...topPlayers.map((playerId) => factoryCounts.get(playerId) ?? 0)
            )
            winners = topPlayers.filter(
                (playerId) => (factoryCounts.get(playerId) ?? 0) === maxFactory
            )
        }

        state.winningPlayerIds = winners
        state.activePlayerIds = []
        state.result = winners.length > 1 ? GameResult.Draw : GameResult.Win
    }

    onAction(): MachineState {
        return MachineState.EndOfGame
    }
}

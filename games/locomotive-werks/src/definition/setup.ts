import { Compile } from 'typebox/compile'
import { assert, type GameConfig } from '@tabletop/common'
import { LwGameConfig, StartingCash } from './gameConfig.js'

export const LwGameConfigValidator = Compile(LwGameConfig)

export type LwSetup = { startingCash: StartingCash; buyAndShip: boolean }

export function readLwSetup(config: GameConfig): LwSetup {
    assert(
        LwGameConfigValidator.Check(config),
        'Game configuration is not a Locomotive Werks setup'
    )
    return {
        startingCash: config.startingCash ?? StartingCash.Standard,
        buyAndShip: config.buyAndShip ?? config.lucasOrder ?? false
    }
}

const FIVE_PLAYERS = 5

const STARTING_CASH: Record<StartingCash, Record<number, number>> = {
    [StartingCash.Standard]: { 3: 10, 4: 12, 5: 14 },
    [StartingCash.Queen]: { 3: 12, 4: 12, 5: 14 },
    [StartingCash.Winsome]: { 3: 10, 4: 10, 5: 14 }
}

export function startingCash(playerCount: number, scheme: StartingCash): number {
    const cash = STARTING_CASH[scheme][playerCount]
    assert(cash !== undefined, `Locomotive Werks has no starting cash for ${playerCount} players`)
    return cash
}

// With five players nobody starts with a works, and only an Initial Orders die is rolled.
export function startsWithWorks(playerCount: number): boolean {
    return playerCount < FIVE_PLAYERS
}

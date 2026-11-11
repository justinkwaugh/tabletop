import * as Type from 'typebox'
import type { RandomFunction } from '@tabletop/common'

export type CupEntry = Type.Static<typeof CupEntry>
export const CupEntry = Type.Object({
    playerId: Type.String(),
    income: Type.Number(),
    cubes: Type.Number()
})

export function fillCup(incomes: readonly { playerId: string; income: number }[]): CupEntry[] {
    const ranked = [...new Set(incomes.map(({ income }) => income))].sort((a, b) => b - a)
    return incomes.map(({ playerId, income }) => ({
        playerId,
        income,
        cubes: ranked.indexOf(income) + 1
    }))
}

export function drawTurnOrder(
    cup: readonly CupEntry[],
    draws: number,
    random: RandomFunction
): string[] {
    const cubes = cup.flatMap(({ playerId, cubes }) => Array<string>(cubes).fill(playerId))
    const drawn: string[] = []
    while (drawn.length < draws && cubes.length > 0) {
        const [playerId] = cubes.splice(Math.floor(random() * cubes.length), 1)
        drawn.push(playerId)
    }
    return drawn
}

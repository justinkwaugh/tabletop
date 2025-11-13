import type { RandomFunction } from './prng'

export function shuffle(array: unknown[], randomFunction?: RandomFunction) {
    if (randomFunction === undefined) {
        randomFunction = Math.random
    }
    for (let i: number = array.length - 1; i > 0; i--) {
        const j = Math.floor(randomFunction() * (i + 1))
        ;[array[i], array[j]] = [array[j], array[i]]
    }
}

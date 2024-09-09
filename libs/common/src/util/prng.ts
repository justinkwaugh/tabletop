function splitmix32(a: number) {
    return function () {
        a |= 0
        a = (a + 0x9e3779b9) | 0
        let t = a ^ (a >>> 16)
        t = Math.imul(t, 0x21f0aaad)
        t = t ^ (t >>> 15)
        t = Math.imul(t, 0x735a2d97)
        return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296
    }
}

export type RandomFunction = () => number

export function generateSeed(): number {
    return (Math.random() * 2 ** 32) >>> 0
}

export function getPrng(seed?: number): RandomFunction {
    if (seed === undefined) {
        seed = generateSeed()
    }
    return splitmix32(seed)
}

export function pickRandom<T>(array: T[], prng: RandomFunction = getPrng()): T {
    const randInt = Math.floor(prng() * array.length)
    return array[randInt]
}

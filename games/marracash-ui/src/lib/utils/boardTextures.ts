// The board's textures are fractal noise, drawn once to WebP images in src/lib/textures by
// scripts/render-textures.mjs rather than by SVG filters in the browser: iOS WebKit sometimes
// can't run those filters on a phone and paints the filtered shapes black. This module has no
// imports so that script can read it too; rerun the script after changing a texture here.

export type NoiseLayer = {
    baseFrequency: string
    numOctaves: number
    seed: number
    // feColorMatrix values: the texture's colour, with its alpha taken from the noise
    matrix: string
}

export type BoardTexture = {
    file: string
    // The tile's size in board units
    size: number
    // Image pixels per board unit: fine noise needs 2 to stay crisp on phones
    resolution: number
    // A texture that always lies on one colour has it baked in; the board draws the colour
    // underneath too, so a texture that fails to load leaves flat colour
    base?: string
    layers: NoiseLayer[]
}

// The wall's walkway and its raised merlons share a grain, seeded differently.
const rammedEarthGrain = (seed: number): NoiseLayer => ({
    baseFrequency: '0.035 0.11',
    numOctaves: 4,
    seed,
    matrix: '0 0 0 0 0.36  0 0 0 0 0.16  0 0 0 0 0.08  1.1 0 0 0 -0.42'
})

export const BoardTextures = {
    // A broad mottle under a fine grit
    packedEarth: {
        file: 'packed-earth',
        size: 400,
        resolution: 2,
        base: '#ead6b6',
        layers: [
            {
                baseFrequency: '0.012',
                numOctaves: 3,
                seed: 21,
                matrix: '0 0 0 0 0.62  0 0 0 0 0.42  0 0 0 0 0.28  0.9 0 0 0 -0.32'
            },
            {
                baseFrequency: '0.55',
                numOctaves: 2,
                seed: 2,
                matrix: '0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.22  0.7 0 0 0 -0.3'
            }
        ]
    },
    // Sized so it never lines up with the packed earth beneath
    streetDust: {
        file: 'street-dust',
        size: 560,
        resolution: 1,
        layers: [
            {
                baseFrequency: '0.0075',
                numOctaves: 4,
                seed: 8,
                matrix: '0 0 0 0 0.5  0 0 0 0 0.36  0 0 0 0 0.22  0.8 0 0 0 -0.42'
            }
        ]
    },
    // Fine enough that a small tile never shows its repeat
    stallWeave: {
        file: 'stall-weave',
        size: 100,
        resolution: 2,
        layers: [
            {
                baseFrequency: '0.9 0.22',
                numOctaves: 2,
                seed: 4,
                matrix: '0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0 0.05  0.9 0 0 0 -0.35'
            }
        ]
    },
    rammedEarth: {
        file: 'rammed-earth',
        size: 180,
        resolution: 2,
        base: '#c47b58',
        layers: [rammedEarthGrain(4)]
    },
    rammedEarthRaised: {
        file: 'rammed-earth-raised',
        size: 180,
        resolution: 2,
        base: '#dc9a72',
        layers: [rammedEarthGrain(9)]
    },
    fountainGlints: {
        file: 'fountain-glints',
        size: 240,
        resolution: 1,
        layers: [
            {
                baseFrequency: '0.06',
                numOctaves: 3,
                seed: 8,
                matrix: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 -0.35'
            }
        ]
    }
} satisfies Record<string, BoardTexture>

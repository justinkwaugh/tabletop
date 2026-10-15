<script lang="ts">
    import { CoralColor } from '@tabletop/reef-encounter'
    import { PolypFaces } from '$lib/images/art.generated.js'

    let { id, seat }: { id: string; seat: number } = $props()

    const Width = 420
    const Height = 52

    const Texture: Record<CoralColor, { face: number; size: number }> = {
        [CoralColor.Orange]: { face: 3, size: 34 },
        [CoralColor.Pink]: { face: 2, size: 30 },
        [CoralColor.Yellow]: { face: 1, size: 40 },
        [CoralColor.White]: { face: 4, size: 34 },
        [CoralColor.Grey]: { face: 2, size: 36 }
    }

    type Kind = 'boulder' | 'staghorn' | 'dome' | 'clump' | 'branch' | 'plate' | 'domes' | 'sprig'
    type Coral = { kind: Kind; x: number; sink: number; scale?: number }

    // Low corals under the name and the fish, the tall ones rising between them.
    const Corals: Coral[] = [
        { kind: 'boulder', x: -6, sink: 4 },
        { kind: 'dome', x: 36, sink: 2 },
        { kind: 'clump', x: 96, sink: 5, scale: 0.95 },
        { kind: 'staghorn', x: 150, sink: 0 },
        { kind: 'branch', x: 190, sink: 6, scale: 0.9 },
        { kind: 'plate', x: 228, sink: 0 },
        { kind: 'dome', x: 262, sink: 8, scale: 0.95 },
        { kind: 'domes', x: 314, sink: -4, scale: 1.15 },
        { kind: 'boulder', x: 360, sink: 3 },
        { kind: 'sprig', x: 400, sink: 4 }
    ]
    const Colors = [
        CoralColor.Grey,
        CoralColor.Orange,
        CoralColor.Yellow,
        CoralColor.Pink,
        CoralColor.White
    ]

    const mirrored = $derived(seat % 2 === 1)
    const colorOf = (index: number) => Colors[(index + seat) % Colors.length]
    const fill = (color: CoralColor) => `url(#${id}-${color})`
</script>

{#snippet coral({ kind, x, sink, scale = 1 }: Coral, color: CoralColor)}
    <g transform="translate({x} {sink + Height * (1 - scale)}) scale({scale})">
        {#if kind === 'boulder'}
            <path
                fill={fill(color)}
                d="M0 52 C0 34 10 26 20 28 C26 22 38 24 42 32 C50 32 54 42 52 52 Z"
            ></path>
        {:else if kind === 'staghorn'}
            <g
                fill="none"
                stroke={fill(color)}
                stroke-width="6.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M22 52 L20 36 L10 24 L6 12"></path>
                <path d="M20 36 L28 22 L26 8"></path>
                <path d="M28 22 L38 14 L40 6"></path>
                <path d="M10 24 L0 18"></path>
                <path d="M22 44 L34 34 L44 30"></path>
            </g>
        {:else if kind === 'dome'}
            <path fill={fill(color)} d="M0 52 C0 30 12 20 30 20 C48 20 62 30 62 52 Z"></path>
        {:else if kind === 'clump'}
            <g fill={fill(color)}>
                <circle cx="12" cy="42" r="12"></circle>
                <circle cx="26" cy="34" r="11"></circle>
                <circle cx="38" cy="44" r="10"></circle>
                <circle cx="20" cy="26" r="8"></circle>
            </g>
        {:else if kind === 'branch'}
            <g
                fill="none"
                stroke={fill(color)}
                stroke-width="4.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M22 52 L20 38 L10 26 L8 14"></path>
                <path d="M20 38 L30 26 L28 12 L34 4"></path>
                <path d="M30 26 L42 20 L46 10"></path>
                <path d="M10 26 L0 22"></path>
                <path d="M22 46 L36 40 L50 38"></path>
            </g>
        {:else if kind === 'plate'}
            <path
                fill={fill(color)}
                d="M0 52 C-2 42 4 36 16 36 C30 34 42 38 44 44 C46 48 44 52 44 52 Z"
            ></path>
        {:else if kind === 'domes'}
            <g fill={fill(color)}>
                <path d="M0 52 C0 40 8 34 18 34 C28 34 36 42 36 52 Z"></path>
                <path d="M30 52 C30 44 36 40 42 40 C48 40 54 44 54 52 Z"></path>
            </g>
        {:else}
            <g
                fill="none"
                stroke={fill(color)}
                stroke-width="5.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M12 52 L10 36 L2 24"></path>
                <path d="M10 36 L18 22 L16 12"></path>
                <path d="M18 22 L28 16"></path>
                <path d="M12 44 L26 36 L38 34"></path>
            </g>
        {/if}
    </g>
{/snippet}

<svg
    class="reef-crest"
    viewBox="0 0 {Width} {Height}"
    preserveAspectRatio="xMinYMax slice"
    aria-hidden="true"
>
    <defs>
        {#each Colors as color (color)}
            <pattern
                id="{id}-{color}"
                patternUnits="userSpaceOnUse"
                width={Texture[color].size}
                height={Texture[color].size}
            >
                <image
                    href={PolypFaces[color][Texture[color].face].url}
                    width={Texture[color].size}
                    height={Texture[color].size}
                ></image>
            </pattern>
        {/each}
    </defs>

    <g transform={mirrored ? `translate(${Width} 0) scale(-1 1)` : undefined}>
        <path
            fill="var(--reef-far)"
            d="M-4 52 V42 C10 34 24 34 36 40 C52 30 72 30 86 39 C100 33 116 33 128 40 C146 30 168 30 184 38
               C198 32 214 32 228 39 C246 29 266 29 282 38 C296 33 312 33 324 40 C340 31 360 31 374 39
               C388 33 404 33 424 40 V52 Z"
        ></path>
        {#each Corals as coralShape, index (index)}
            {@render coral(coralShape, colorOf(index))}
        {/each}
        <path
            fill="var(--reef-rock)"
            d="M-4 52 V47 q12 -4 24 -1 q14 -5 28 -1 q16 -4 30 0 q16 -5 34 -1 q18 -4 34 0 q14 -4 30 -1 q16 -4 32 0
               q18 -5 34 -1 q14 -4 28 0 q18 -5 34 -1 q16 -3 30 0 q14 -4 28 -1 q14 -3 30 1 H424 V52 Z"
        ></path>
    </g>
</svg>

<style>
    .reef-crest {
        display: block;
        width: 100%;
        height: 52px;
    }
</style>

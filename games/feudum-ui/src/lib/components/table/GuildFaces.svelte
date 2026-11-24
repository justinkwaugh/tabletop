<script lang="ts">
    import { assetUrl, guildPanelAsset } from '$lib/art/assetMap.js'
    import type { GuildSide } from '$lib/model/boardFocus.svelte.js'
    import { GuildBox, guildsDownSide } from '$lib/utils/boardGeometry.js'
    import { PrintedFaceRadius, PrintedFaces, printedFaceTurn } from '$lib/utils/printedGuilds.js'

    let { side }: { side: GuildSide } = $props()

    const FaceBox = `${-PrintedFaceRadius} ${-PrintedFaceRadius} ${2 * PrintedFaceRadius} ${2 * PrintedFaceRadius}`

    let faces = $derived(
        guildsDownSide(side === 'west').flatMap((guild) => {
            const url = assetUrl(guildPanelAsset(guild))
            return url
                ? [{ guild, url, centre: PrintedFaces[guild], turn: printedFaceTurn(guild) }]
                : []
        })
    )
</script>

{#if faces.length > 0}
    <span class="faces" aria-hidden="true" data-guild-faces={side}>
        {#each faces as { guild, url, centre, turn } (guild)}
            <span class="ring" data-face-ring>
                <svg width="36" height="36" viewBox={FaceBox} data-guild-face={guild}>
                    <image
                        href={url}
                        x={-centre.x}
                        y={-centre.y}
                        width={GuildBox.width}
                        height={GuildBox.height}
                        transform="rotate({turn})"
                    ></image>
                </svg>
            </span>
        {/each}
    </span>
{/if}

<style>
    .faces {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .ring {
        display: block;
        flex: none;
        overflow: hidden;
        border: 2px solid var(--feudum-gilt);
        border-radius: 50%;
        box-shadow:
            0 0 0 1.5px var(--feudum-wood-dark),
            0 2px 4px color-mix(in srgb, var(--feudum-halo) 60%, transparent);
    }

    .ring svg {
        display: block;
    }
</style>

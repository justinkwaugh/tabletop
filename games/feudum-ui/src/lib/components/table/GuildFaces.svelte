<script lang="ts">
    import { assetUrl, guildPanelAsset } from '$lib/art/assetMap.js'
    import type { GuildSide } from '$lib/model/boardFocus.svelte.js'
    import { GuildBox, guildsDownSide, uprightTurn } from '$lib/utils/boardGeometry.js'
    import { PrintedFaceRadius, PrintedFaces } from '$lib/utils/printedGuilds.js'

    /**
     * Contract, Desk layout: under a side button's label, its three guilds' faces, top to bottom in
     * the bench's order, each cut round from that guild's print and turned upright as the open side
     * turns it. They are decoration, so the button's name stays its label's. A guild whose print the
     * folder lacks shows no face.
     */
    let { side }: { side: GuildSide } = $props()

    const r = PrintedFaceRadius
    let faces = $derived(
        guildsDownSide(side === 'west').flatMap((guild) => {
            const url = assetUrl(guildPanelAsset(guild))
            return url ? [{ guild, url, centre: PrintedFaces[guild] }] : []
        })
    )
</script>

{#if faces.length > 0}
    <span class="faces" aria-hidden="true" data-guild-faces={side}>
        {#each faces as { guild, url, centre } (guild)}
            <span class="ring" data-face-ring>
                <svg
                    width="36"
                    height="36"
                    viewBox="{centre.x - r} {centre.y - r} {2 * r} {2 * r}"
                    data-guild-face={guild}
                >
                    <image
                        href={url}
                        width={GuildBox.width}
                        height={GuildBox.height}
                        transform="rotate({uprightTurn(guild)} {centre.x} {centre.y})"
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

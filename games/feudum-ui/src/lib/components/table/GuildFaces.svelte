<script lang="ts">
    import { assetUrl, guildFaceAsset } from '$lib/art/assetMap.js'
    import type { GuildSide } from '$lib/model/boardFocus.svelte.js'
    import { guildsDownSide } from '$lib/utils/boardGeometry.js'

    /** Contract, Desk layout: small cut faces, so the prints stay unloaded until a side opens. */
    let { side }: { side: GuildSide } = $props()

    let faces = $derived(
        guildsDownSide(side === 'west').flatMap((guild) => {
            const url = assetUrl(guildFaceAsset(guild))
            return url ? [{ guild, url }] : []
        })
    )
</script>

{#if faces.length > 0}
    <span class="faces" aria-hidden="true" data-guild-faces={side}>
        {#each faces as { guild, url } (guild)}
            <span class="ring" data-face-ring>
                <img src={url} alt="" width="36" height="36" data-guild-face={guild} />
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

    .ring img {
        display: block;
    }
</style>

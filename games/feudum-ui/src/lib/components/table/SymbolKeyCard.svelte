<script lang="ts">
    import { Goods, GuildById, GuildIds, LocationKinds, VesselTypes } from '@tabletop/feudum'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import GuildDie from '$lib/components/pieces/GuildDie.svelte'
    import LocationDisc from '$lib/components/pieces/LocationDisc.svelte'
    import PawnPiece from '$lib/components/pieces/PawnPiece.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import type { SeatPaint } from '$lib/model/seatPaint.js'

    /** Contract, Symbol key: each piece beside its name, seat pieces in the viewer's colour. */
    let { paint }: { paint: SeatPaint } = $props()

    const Piece = 22
</script>

{#snippet entry(caption: string, art: import('svelte').Snippet)}
    <li class="entry">
        <span class="art">{@render art()}</span>
        <span class="caption" data-key-caption>{caption}</span>
    </li>
{/snippet}

<div class="key" role="group" aria-label="Symbol key" data-symbol-key>
    <section>
        <h3>Guilds</h3>
        <ul>
            {#each GuildIds as guild (guild)}
                {#snippet die()}<GuildDie {guild} size={Piece} phoneSize={Piece} />{/snippet}
                {@render entry(GuildById[guild].name, die)}
            {/each}
        </ul>
    </section>
    <section>
        <h3>Goods</h3>
        <ul>
            {#each Goods as good (good)}
                {#snippet cube()}<GoodToken {good} size={Piece} />{/snippet}
                {@render entry(good, cube)}
            {/each}
            {#snippet coin()}<ShillingToken value={1} size={Piece} />{/snippet}
            {@render entry('shilling', coin)}
            {#snippet seal()}<SealFace faceShown={false} size={Piece} />{/snippet}
            {@render entry("king's seal", seal)}
            {#snippet barrel()}<span class="barrel"><GoodToken good="sulfur" size={Piece} /></span
                >{/snippet}
            {@render entry('sulfur in a barrel', barrel)}
        </ul>
    </section>
    <section>
        <h3>Places</h3>
        <ul>
            {#each LocationKinds as place (place)}
                {#snippet disc()}<LocationDisc kind={place} size={Piece} />{/snippet}
                {@render entry(place, disc)}
            {/each}
        </ul>
    </section>
    <section>
        <h3>Vessels</h3>
        <ul>
            {#each VesselTypes as vessel (vessel)}
                {#snippet token()}<VesselToken {vessel} size={Piece} />{/snippet}
                {@render entry(vessel.replace('-', ' '), token)}
            {/each}
        </ul>
    </section>
    <section>
        <h3>Pieces</h3>
        <ul>
            {#snippet tile()}<TileFace faceShown={false} epoch={1} size={Piece} />{/snippet}
            {@render entry('region tile', tile)}
            {#snippet writ()}<WritFace faceShown={false} width={16} />{/snippet}
            {@render entry('writ', writ)}
            {#snippet marker()}<SeatToken kind="marker" {paint} size={Piece} />{/snippet}
            {@render entry('influence marker', marker)}
            {#snippet playerDisc()}<SeatToken kind="disc" {paint} size={Piece} />{/snippet}
            {@render entry('player disc', playerDisc)}
            {#snippet pawn()}<PawnPiece {paint} size={Piece} />{/snippet}
            {@render entry('pawn', pawn)}
        </ul>
    </section>
    <section>
        <h3>Marks</h3>
        <ul>
            {#snippet rose()}<span
                    class="chip bg-feudum-danger-soft text-feudum-danger"
                    data-chip-sample="rose">1</span
                >{/snippet}
            {@render entry('a cost or threat', rose)}
            {#snippet amber()}<span
                    class="chip bg-feudum-primary text-feudum-accent"
                    data-chip-sample="amber">+3</span
                >{/snippet}
            {@render entry('yours to take', amber)}
            {#snippet badge()}<GuildDie
                    guild="farmer"
                    rank="master"
                    size={Piece}
                    phoneSize={Piece}
                />{/snippet}
            {@render entry('rank it gives', badge)}
        </ul>
    </section>
</div>

<style>
    .key {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
        gap: 0.5rem 1rem;
        max-width: min(36rem, calc(100vw - 2rem));
        max-height: min(28rem, 70dvh);
        min-height: 0;
        overflow-y: auto;
        padding: 0.75rem;
        border: 1px solid var(--feudum-accent);
        border-radius: 0.5rem;
        background: var(--feudum-surface-raised);
        color: var(--feudum-text);
        font-size: 0.8125rem;
    }

    h3 {
        margin: 0 0 0.25rem;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--feudum-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    ul {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .entry {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .art {
        display: inline-flex;
        flex: none;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        line-height: 0;
    }

    .barrel {
        display: inline-flex;
        border: 2px solid var(--feudum-wood-dark);
        border-radius: 0.375rem;
        padding: 1px;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        border-radius: 9999px;
        padding: 0 0.4rem;
        font-weight: 700;
        line-height: 1.25rem;
        box-shadow: 0 0 0 2px var(--feudum-halo);
    }
</style>

<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import MonsterToken from '$lib/components/pieces/MonsterToken.svelte'
    import PawnPiece from '$lib/components/pieces/PawnPiece.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import type { SiteCard } from '$lib/model/siteCard.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'

    /**
     * R-4.1 Everything on one site at once, each row its pieces and its words: the markers by role,
     * the pawns by seat, monsters, the landscape, the goods by kind with their counts, and abandoned
     * vessels. It shows only what the table shows.
     */
    let {
        card,
        paintOf,
        onClose
    }: { card: SiteCard; paintOf: (playerId: string) => SeatPaint; onClose?: () => void } = $props()

    const Piece = 20
</script>

<div
    class="flex max-w-72 flex-col gap-1.5 rounded-lg border border-feudum-accent bg-feudum-surface-raised p-2 text-sm text-feudum-text"
    data-site-card={card.spaceId}
>
    <div class="flex items-center justify-between gap-2">
        <p class="font-bold text-feudum-heading">{card.title}</p>
        {#if onClose}
            <button
                type="button"
                class="rounded px-1.5 text-feudum-text-muted hover:bg-feudum-control-hover"
                aria-label="Close"
                onclick={onClose}>×</button
            >
        {/if}
    </div>
    {#each card.markers as marker (marker.role)}
        <div class="flex items-center gap-1.5">
            <SeatToken kind="marker" paint={paintOf(marker.playerId)} size={Piece} />
            <span>{marker.label}</span>
            {#if marker.immune}
                <SealFace faceShown={false} size={16} />
                <span class="text-feudum-text-muted">immune</span>
            {/if}
        </div>
    {/each}
    {#if card.pawnsLine}
        <div class="flex flex-col gap-0.5">
            <div class="flex flex-wrap items-center gap-0.5">
                {#each card.pawns as seat (seat.playerId)}
                    {#each seat.characters as character, index (index)}
                        <PawnPiece
                            paint={paintOf(seat.playerId)}
                            {character}
                            drunk={seat.drunk[index]}
                            size={24}
                        />
                    {/each}
                {/each}
            </div>
            <span>{card.pawnsLine}</span>
        </div>
    {/if}
    {#each card.monsters as monster (monster.monster)}
        <div class="flex items-center gap-1.5">
            <MonsterToken
                monster={monster.monster}
                {...monster.playerId ? { paint: paintOf(monster.playerId) } : {}}
                size={24}
            />
            <span>{monster.label}</span>
        </div>
    {/each}
    {#if card.landscape}
        <p>{card.landscape}</p>
    {/if}
    {#if card.goods.length > 0}
        <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {#each card.goods as { good, count } (good)}
                <span class="flex items-center gap-0.5" data-site-good={good}>
                    <GoodToken {good} size={Piece} />
                    <span class="font-bold">{count}</span>
                </span>
            {/each}
        </div>
    {/if}
    {#each card.vessels as { vessel, count } (vessel)}
        <div class="flex items-center gap-1.5">
            <VesselToken {vessel} size={24} />
            <span>{count > 1 ? `${count} ` : ''}{vessel.replace('-', ' ')}, abandoned</span>
        </div>
    {/each}
</div>

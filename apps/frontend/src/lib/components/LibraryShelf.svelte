<script lang="ts">
    import { getTitleVisibility } from '@tabletop/common'
    import { UsersOutline } from 'flowbite-svelte-icons'
    import LibraryTile from '$lib/components/LibraryTile.svelte'
    import SeriesCoverCycle from '$lib/components/SeriesCoverCycle.svelte'
    import { getLoginModal } from '$lib/stores/loginModal'
    import {
        gameCount,
        playerCountText,
        seriesUrl,
        titleMaturityLabel,
        type LibraryShelfItem
    } from '$lib/utils/libraryTitles'

    let { id, items, signedIn }: { id?: string; items: LibraryShelfItem[]; signedIn: boolean } =
        $props()
    const openLoginModal = getLoginModal()
</script>

<ul {id} class="game-shelf">
    {#each items as item (item.kind === 'series' ? item.series.id : item.title.id)}
        <li>
            {#if item.kind === 'series'}
                <LibraryTile
                    action={{ href: seriesUrl(item.series) }}
                    label={`View ${item.series.name}, ${gameCount(item.titles.length)}`}
                    name={item.series.name}
                >
                    {#snippet cover(engaged)}
                        <SeriesCoverCycle titles={item.titles} paused={engaged} />
                    {/snippet}
                    {#snippet caption()}
                        {gameCount(item.titles.length)}
                    {/snippet}
                </LibraryTile>
            {:else}
                {@const title = item.title}
                {@const maturityLabel = titleMaturityLabel(title.metadata)}
                <LibraryTile
                    action={signedIn
                        ? { href: `/library/${title.id}` }
                        : { onclick: openLoginModal }}
                    label={signedIn
                        ? `View ${title.metadata.name}${maturityLabel ? `, ${maturityLabel}` : ''}`
                        : `Sign in to play ${title.metadata.name}`}
                    name={title.metadata.name}
                >
                    {#snippet cover()}
                        <img
                            src={title.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            data-game-cover={title.id}
                        />
                        {#if maturityLabel}
                            <span
                                class="maturity-label"
                                data-visibility={getTitleVisibility(title.metadata)}
                                >{maturityLabel}</span
                            >
                        {/if}
                    {/snippet}
                    {#snippet caption()}
                        <UsersOutline class="h-3.5 w-3.5" />
                        {playerCountText(title.metadata)}
                    {/snippet}
                </LibraryTile>
            {/if}
        </li>
    {/each}
</ul>

<style>
    .game-shelf {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 30px 20px;
    }

    .maturity-label {
        position: absolute;
        top: 16px;
        left: -34px;
        width: 130px;
        padding: 4px 0;
        transform: rotate(-45deg);
        color: var(--color-gray-900);
        font-size: 13px;
        font-weight: 700;
        text-align: center;
    }

    .maturity-label[data-visibility='alpha'] {
        background: var(--color-orange-500);
    }

    .maturity-label[data-visibility='beta'] {
        background: var(--color-amber-400);
    }

    @media (max-width: 1000px) {
        .game-shelf {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
    }

    @media (max-width: 700px) {
        .game-shelf {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 24px 16px;
        }
    }
</style>

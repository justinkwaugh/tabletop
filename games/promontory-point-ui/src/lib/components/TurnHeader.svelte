<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { turnHeader } from '$lib/model/turnHeader.js'

    const gameSession = getGameSession()

    const view = $derived(turnHeader(gameSession))
</script>

<!-- A paper strip: a sea-teal tab says whose turn it is; Undo is a brown tab at the right end. -->
<div class="turn flex h-10 items-center max-sm:h-[30px]">
    <div class="tab" data-turn-tab>
        <h2 class="heading text-[19px] max-sm:text-[15px]">{view.heading}</h2>
    </div>
    <span class="info min-w-0 truncate px-3.5 text-sm max-sm:px-2 max-sm:text-xs" data-turn-info
        >{view.info}</span
    >
    <!-- R-X.2: shown only when a press would do something; a draw leaves nothing to undo. -->
    {#if gameSession.canUndo}
        <!-- Contract, "Phone layout": a 44 px target around the tab, overhanging the 30 px header. -->
        <button
            type="button"
            class="ml-auto flex shrink-0 items-center pr-1.5 max-sm:-my-[7px] max-sm:h-11"
            onclick={() => gameSession.undo()}
            ><span class="undo px-3.5 max-sm:px-3">Undo</span></button
        >
    {/if}
</div>

<style>
    .turn {
        background: var(--pp-paper);
        color: var(--pp-ink);
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 2px 0 color-mix(in srgb, var(--pp-halo) 30%, transparent);
    }

    .tab {
        height: 100%;
        display: flex;
        align-items: center;
        flex: none;
        padding: 0 22px 0 14px;
        background: var(--pp-teal);
        color: var(--pp-paper);
        box-shadow: inset 0 -3px 0 var(--pp-teal-deep);
        clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
    }

    .heading {
        font-family: Oswald, sans-serif;
        font-weight: 600;
        line-height: 1;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .info {
        font-family: Oswald, sans-serif;
        font-weight: 500;
        letter-spacing: 0.02em;
    }

    .undo {
        display: inline-flex;
        align-items: center;
        height: 28px;
        border-radius: 3px;
        background: var(--pp-brown);
        color: var(--pp-paper);
        font-family: Oswald, sans-serif;
        font-weight: 500;
        font-size: 14px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    @media (width < 40rem) {
        .tab {
            padding: 0 16px 0 10px;
        }

        .undo {
            height: 22px;
            font-size: 12px;
        }
    }
</style>

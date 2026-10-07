<script lang="ts">
    import { MAP_RECT } from '$lib/utils/boardLayout.js'

    let {
        onZoomToMap,
        onShowBoard,
        onToggleFullScreen
    }: { onZoomToMap: () => void; onShowBoard: () => void; onToggleFullScreen: () => void } =
        $props()

    const BUTTON = 34
    const GAP = 6

    const buttons = $derived([
        { label: 'Zoom in on the map', icon: 'zoom-in', action: onZoomToMap },
        { label: 'Show the whole board', icon: 'zoom-out', action: onShowBoard },
        { label: 'Toggle full screen', icon: 'fullscreen', action: onToggleFullScreen }
    ])

    function onKey(event: KeyboardEvent, action: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            action()
        }
    }
</script>

<g transform="translate({MAP_RECT.x + 12} {MAP_RECT.y + 12})">
    <rect
        width={buttons.length * (BUTTON + GAP) + GAP}
        height={BUTTON + GAP * 2}
        rx="10"
        class="tray"
    />
    {#each buttons as button, index (button.icon)}
        <g
            transform="translate({GAP + index * (BUTTON + GAP)} {GAP})"
            class="button"
            role="button"
            tabindex="0"
            aria-label={button.label}
            onclick={button.action}
            onkeydown={(event) => onKey(event, button.action)}
        >
            <title>{button.label}</title>
            <rect width={BUTTON} height={BUTTON} rx="7" class="face" />
            <g transform="translate({BUTTON / 2} {BUTTON / 2})" class="icon">
                {#if button.icon === 'fullscreen'}
                    <path d="M -10 -4 V -10 H -4 M 4 -10 H 10 V -4 M 10 4 V 10 H 4 M -4 10 H -10 V 4" />
                {:else}
                    <circle cx="-2" cy="-2" r="7" />
                    <path d="M 3 3 L 10 10 M -6 -2 H 2" />
                    {#if button.icon === 'zoom-in'}
                        <path d="M -2 -6 V 2" />
                    {/if}
                {/if}
            </g>
        </g>
    {/each}
</g>

<style>
    .tray {
        fill: rgba(122, 29, 34, 0.88);
        stroke: #f2e2bd;
        stroke-width: 1.5;
    }

    .button {
        cursor: pointer;
        outline: none;
    }

    .face {
        fill: #fdf8ec;
    }

    .button:hover .face,
    .button:focus-visible .face {
        fill: #ffe796;
    }

    .icon {
        fill: none;
        stroke: #7a1d22;
        stroke-width: 2.4;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
</style>

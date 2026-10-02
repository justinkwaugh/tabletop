<script lang="ts">
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/utils/boardGeometry.js'
    import ActionCardPanel from './ActionCardPanel.svelte'
    import RoundTab from './RoundTab.svelte'
    import PiecesLayer from './board/PiecesLayer.svelte'
    import SeaLayer from './board/SeaLayer.svelte'
    import TargetLayer from './board/TargetLayer.svelte'
    import TerrainLayer from './board/TerrainLayer.svelte'
</script>

<div class="board-folder">
    <RoundTab />
    <div class="board-shell">
        <svg
            class="board-surface"
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            viewBox="0 0 {BOARD_WIDTH} {BOARD_HEIGHT}"
            aria-label="Magna Grecia board"
        >
            <defs>
                <linearGradient id="mg-sea" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#2f93b1"></stop>
                    <stop offset="0.55" stop-color="#23779a"></stop>
                    <stop offset="1" stop-color="#1a5b78"></stop>
                </linearGradient>
                <radialGradient id="mg-land-shade">
                    <stop offset="0" stop-color="#fff8e0" stop-opacity="0.16"></stop>
                    <stop offset="0.7" stop-color="#fff8e0" stop-opacity="0"></stop>
                    <stop offset="1" stop-color="#6b4a1c" stop-opacity="0.16"></stop>
                </radialGradient>
                <linearGradient id="mg-marble" x1="0" y1="0" x2="0.4" y2="1">
                    <stop offset="0" stop-color="#fdfbf6"></stop>
                    <stop offset="0.6" stop-color="#ece6da"></stop>
                    <stop offset="1" stop-color="#d6cfc0"></stop>
                </linearGradient>
                <filter id="mg-tile-shadow" x="-10%" y="-10%" width="125%" height="130%">
                    <feDropShadow
                        dx="1.5"
                        dy="2.5"
                        stdDeviation="1.6"
                        flood-color="#3a2410"
                        flood-opacity="0.45"
                    ></feDropShadow>
                </filter>
            </defs>
            <SeaLayer />
            <TerrainLayer />
            <PiecesLayer />
            <TargetLayer />
        </svg>
        <ActionCardPanel />
    </div>
</div>

<style>
    .board-folder {
        --sheet-color: #e9e0cc;
        --sheet-light-size: 900px 600px;
        --sheet-light-x: 248px;
        --sheet-light-y: 111px;
        --tab-height: 64px;
        display: inline-flex;
        flex-direction: column;
        align-items: flex-start;
    }

    .board-shell {
        display: flex;
        align-items: flex-start;
        gap: 18px;
        padding: 12px;
        border-radius: 0 22px 22px 22px;
        background:
            radial-gradient(
                var(--sheet-light-size) at var(--sheet-light-x) var(--sheet-light-y),
                rgba(255, 255, 255, 0.35),
                transparent 60%
            ),
            var(--sheet-color);
    }

    .board-surface {
        border-radius: 16px;
        box-shadow:
            0 0 0 5px rgba(139, 91, 46, 0.35),
            0 12px 26px rgba(40, 24, 8, 0.25);
    }
</style>

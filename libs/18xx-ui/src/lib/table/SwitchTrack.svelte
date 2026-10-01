<script lang="ts">
    let { on }: { on: boolean } = $props()
</script>

<span class="switch-track" class:on aria-hidden="true"></span>

<style>
    .switch-track {
        position: relative;
        flex: none;
        box-sizing: border-box;
        width: 26px;
        height: 14px;
        border-radius: 999px;
        border: 1px solid var(--rail-border, #485666);
        background: var(--rail-surface-inset, #1b232d);
        transition:
            background-color 180ms ease,
            border-color 180ms ease;
    }
    .switch-track::after {
        content: '';
        position: absolute;
        top: 1px;
        left: 1px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--rail-muted, #7f8e9e);
        transition:
            transform 180ms ease,
            background-color 180ms ease;
    }
    .on {
        border-color: transparent;
        background: var(--rail-positive, #2e7d5b);
    }
    .on::after {
        transform: translateX(12px);
        background: #ffffff;
    }
    @media (prefers-reduced-motion: reduce) {
        .switch-track,
        .switch-track::after {
            transition: none;
        }
    }
</style>

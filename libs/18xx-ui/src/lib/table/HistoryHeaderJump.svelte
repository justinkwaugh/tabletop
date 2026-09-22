<script lang="ts">
    let {
        label,
        disabled = false,
        onclick,
        onReturn
    }: {
        label: string
        disabled?: boolean
        onclick: () => void
        onReturn?: () => void
    } = $props()
</script>

<button class="jump" type="button" aria-label={label} title={label} {disabled} {onclick}></button>
{#if onReturn}
    <button
        class="return"
        type="button"
        aria-label="Return to current game"
        title="Return to current game"
        {disabled}
        onclick={onReturn}
    >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.5 8.046H11V6.119c0-.921-.9-1.446-1.524-.894l-5.108 4.49a1.2 1.2 0 0 0 0 1.739l5.108 4.49c.624.556 1.524.027 1.524-.893v-1.928h2a3.023 3.023 0 0 1 3 3.046V19a5.593 5.593 0 0 0-1.5-10.954Z"
            ></path>
        </svg>
    </button>
{/if}

<style>
    button {
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }
    .jump {
        position: absolute;
        z-index: 1;
        inset: 0;
        width: 100%;
        height: 100%;
        padding: 0;
    }
    .jump:hover:not(:disabled) {
        background: var(--rail-hover, #49352a20);
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: -2px;
    }
    button:disabled {
        cursor: default;
    }
    .return {
        position: relative;
        z-index: 2;
        display: inline-flex;
        flex: none;
        padding: 2px 4px;
        border-radius: 3px;
    }
    .return:hover:not(:disabled) {
        background: var(--rail-hover, #49352a20);
    }
    .return:disabled {
        opacity: 0.35;
    }
</style>

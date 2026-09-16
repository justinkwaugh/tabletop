<script lang="ts">
    let { showDetails, onDisplayChange }: {
        showDetails: boolean
        onDisplayChange: (details: boolean) => void
    } = $props()
</script>

        <div class="chip-style" role="group" aria-label="Operating order chip style">
            <button
                aria-label="Tokens only"
                aria-pressed={!showDetails}
                onclick={() => onDisplayChange(false)}
            >
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" fill="currentColor" />
                </svg>
            </button>
            <span class="separator" aria-hidden="true">/</span>
            <button
                aria-label="Detailed chips"
                aria-pressed={showDetails}
                onclick={() => onDisplayChange(true)}
            >
                <svg width="25" height="14" viewBox="0 0 29 16" aria-hidden="true">
                    <path
                        d="M8 1.5H24Q27.5 1.5 27.5 5V11Q27.5 14.5 24 14.5H8A6.5 6.5 0 0 1 8 1.5Z"
                        fill="none"
                        stroke="currentColor"
                    />
                    <circle cx="8" cy="8" r="7" fill="currentColor" />
                </svg>
            </button>
        </div>

<style>
    .chip-style {
        display: flex;
        align-items: center;
        gap: 3px;
        flex-shrink: 0;
        color: #695540;
    }
    .chip-style button {
        display: flex;
        align-items: center;
        padding: 1px 2px;
        border: 0;
        border-radius: 3px;
        background: transparent;
        color: inherit;
        opacity: 0.55;
        cursor: pointer;
    }
    .chip-style button[aria-pressed='true'],
    .chip-style button:hover {
        opacity: 1;
    }
    .chip-style button:focus-visible {
        outline: 2px solid #796047;
        outline-offset: 1px;
    }
    .separator {
        color: #a18c75;
        font-size: 12px;
    }
</style>

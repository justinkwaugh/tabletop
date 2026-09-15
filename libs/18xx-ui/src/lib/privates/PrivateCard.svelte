<script lang="ts">
    let {
        name,
        description,
        value,
        income,
        purchaseRange
    }: {
        name: string
        description: string
        value?: number
        income?: number
        purchaseRange?: { minimum: number; maximum?: number }
    } = $props()
</script>

<div class="private-card">
    <header>
        <h3>{name}</h3>
        {#if value !== undefined || income !== undefined || purchaseRange}
            <div class="values">
                {#if income !== undefined}<span
                        >Income <strong
                            >${income.toLocaleString('en-US')}{#if !purchaseRange}<small> / OR</small>{/if}</strong
                        ></span
                    >{/if}
                {#if purchaseRange}<span class="value">Purchase <strong>${purchaseRange.minimum}{#if purchaseRange.maximum !== undefined}–${purchaseRange.maximum}{/if}</strong></span>
                {:else if value !== undefined}<span class="value"
                        >Value <strong>${value.toLocaleString('en-US')}</strong></span
                    >{/if}
            </div>
        {/if}
    </header>
    {#if description}<p>{description}</p>{/if}
</div>

<style>
    .private-card {
        border: 1px solid #c9baa5;
        border-radius: 8px;
        background: #fffdf8;
        color: #514538;
        overflow: hidden;
        font-size: 12px;
        line-height: 1.45;
        font-weight: 400;
    }
    header {
        padding: 9px 12px;
        background: #efe7db;
    }
    h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 650;
        line-height: 1.3;
    }
    .value {
        margin-left: auto;
        text-align: right;
    }
    .values {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin-top: 5px;
        color: #786550;
        font-size: 11px;
    }
    strong {
        color: #514538;
        font-size: 12px;
        font-weight: 600;
        margin-left: 3px;
    }
    small {
        font-size: 10px;
        font-weight: 400;
    }
    p {
        margin: 0;
        padding: 9px 12px;
    }
</style>

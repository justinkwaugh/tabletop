<!-- What a railroad's cubes are for (R-1.1): a share certificate, a slash, a locomotive. Drawn in
     ink, flat. -->
<span class="mark" aria-hidden="true">
    <svg width="20" height="16" viewBox="0 0 18 14">
        <!-- A share certificate: a sheet with a seal and two lines of text. -->
        <rect
            x="1"
            y="1"
            width="16"
            height="12"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
        ></rect>
        <line x1="3.6" y1="4.6" x2="10.4" y2="4.6" stroke="currentColor" stroke-width="1.3"></line>
        <line x1="3.6" y1="7.6" x2="8.6" y2="7.6" stroke="currentColor" stroke-width="1.3"></line>
        <circle cx="13" cy="9.2" r="2" fill="currentColor"></circle>
    </svg>
    <span class="slash">/</span>
    <svg width="25" height="16" viewBox="0 0 22 14">
        <!-- A locomotive side on: cab, boiler, chimney and three wheels. -->
        <path
            d="M2 3 H7 V6 H17 V4 H19 V6 H20 V10.5 H2 Z M3.4 4.4 V6.4 H5.6 V4.4 Z"
            fill="currentColor"
            fill-rule="evenodd"
        ></path>
        <circle
            cx="5"
            cy="11.6"
            r="1.9"
            fill="currentColor"
            stroke="var(--rtr-panel)"
            stroke-width="0.8"
        ></circle>
        <circle
            cx="10.5"
            cy="11.6"
            r="1.9"
            fill="currentColor"
            stroke="var(--rtr-panel)"
            stroke-width="0.8"
        ></circle>
        <circle
            cx="16"
            cy="11.6"
            r="1.9"
            fill="currentColor"
            stroke="var(--rtr-panel)"
            stroke-width="0.8"
        ></circle>
    </svg>
</span>

<style>
    .mark {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--rtr-ink-muted);
    }

    .slash {
        font-size: 16px;
        line-height: 1;
    }
</style>

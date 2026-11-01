<!-- Texas Special's paper carries a faint geography (regional tints, rivers, state lines and
     names) and a few ink drawings in corners no track crosses, placed by eye on the printed layout. -->
<script lang="ts">
    const TINTS = [
        { id: 'prairie', x: 250, y: 567, rx: 300, ry: 330, color: '#e9d79a' },
        { id: 'ozarks', x: 785, y: 801, rx: 260, ry: 260, color: '#c5cfa6' },
        { id: 'piney-woods', x: 801, y: 1335, rx: 190, ry: 300, color: '#bcc9a2' },
        { id: 'hill-country', x: 284, y: 1469, rx: 300, ry: 260, color: '#e6d6a8' }
    ]

    const RIVERS = [
        {
            d: 'M 20 1045 Q 20 1045 77 1047 Q 134 1048 192 1037 Q 250 1025 296 1017 Q 342 1008 390 1005 Q 437 1001 488 1008 Q 538 1015 580 1027 Q 621 1038 655 1060 Q 688 1081 712 1106 Q 735 1131 750 1150 Q 765 1168 785 1192 Q 805 1215 825 1259 Q 845 1302 867 1344 Q 888 1385 922 1419 L 955 1452',
            width: 3.2
        },
        {
            d: 'M 18 627 Q 18 627 59 643 Q 100 659 134 680 Q 167 701 201 743 Q 234 784 259 818 Q 284 851 318 864 Q 351 876 384 876 Q 417 876 459 897 Q 501 918 543 939 Q 584 959 619 972 Q 654 984 686 1000 Q 718 1015 752 1025 Q 785 1035 827 1056 Q 868 1076 918 1097 L 968 1118',
            width: 2.4
        },
        {
            d: 'M 965 330 Q 965 330 959 424 Q 953 517 966 617 Q 978 717 971 784 Q 963 851 973 926 Q 982 1001 975 1085 Q 968 1168 976 1235 Q 983 1302 973 1377 Q 962 1452 954 1511 Q 945 1569 962 1619 Q 978 1669 987 1719 L 995 1769',
            width: 4.5
        }
    ]

    const STATE_LINES = [
        'M 347 320 L 371 450 L 421 584 L 471 717 L 501 838',
        'M 20 831 L 501 838',
        'M 501 859 L 985 859',
        'M 501 859 L 601 921 L 656 978 L 671 1028',
        'M 765 1171 L 968 1202',
        'M 765 1171 L 755 1335 L 765 1469 L 760 1627 L 771 1769'
    ]

    const STATES = [
        { text: 'KANSAS', x: 90, y: 737, rotate: 0 },
        { text: 'MISSOURI', x: 928, y: 602, rotate: 90 },
        { text: 'OKLAHOMA', x: 25, y: 889, rotate: -90 },
        { text: 'ARKANSAS', x: 910, y: 801, rotate: 0 },
        { text: 'TEXAS', x: 78, y: 1240, rotate: 0 },
        { text: 'LOUISIANA', x: 938, y: 1322, rotate: 90 }
    ]
</script>

<defs>
    {#each TINTS as tint (tint.id)}
        <radialGradient id="ts-tint-{tint.id}">
            <stop offset="0%" stop-color={tint.color} />
            <stop offset="55%" stop-color={tint.color} stop-opacity="0.85" />
            <stop offset="100%" stop-color={tint.color} stop-opacity="0" />
        </radialGradient>
    {/each}
</defs>

<g class="geography" aria-hidden="true">
    <g opacity="0.55">
        {#each TINTS as tint (tint.id)}
            <ellipse
                cx={tint.x}
                cy={tint.y}
                rx={tint.rx * 1.35}
                ry={tint.ry * 1.35}
                fill="url(#ts-tint-{tint.id})"
            />
        {/each}
    </g>
    {#each STATE_LINES as d (d)}
        <path {d} class="state-line" />
    {/each}
    {#each RIVERS as river (river.d)}
        <path d={river.d} class="river" stroke-width={river.width} />
    {/each}
    {#each STATES as state (state.text)}
        <text
            class="state"
            x={state.x}
            y={state.y}
            transform={state.rotate ? `rotate(${state.rotate} ${state.x} ${state.y})` : undefined}
            >{state.text}</text
        >
    {/each}
</g>

<g class="drawings" aria-hidden="true">
    <!-- A longhorn skull west of Abilene -->
    <g
        transform="translate(70 1539) scale(1.05)"
        fill="none"
        stroke="#4e5b66"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path
            d="M -9 -6 C -20 -10 -34 -8 -46 -24 C -45 -10 -32 -1 -11 2"
            fill="#4e5b66"
            fill-opacity="0.18"
        />
        <path
            d="M 9 -6 C 20 -10 34 -8 46 -24 C 45 -10 32 -1 11 2"
            fill="#4e5b66"
            fill-opacity="0.18"
        />
        <path
            d="M -11 -6 C -15 8 -8 26 0 34 C 8 26 15 8 11 -6 C 6 -11 -6 -11 -11 -6 Z"
            fill="#fbf6e7"
        />
        <ellipse cx="-5" cy="4" rx="2.6" ry="3.4" fill="#4e5b66" />
        <ellipse cx="5" cy="4" rx="2.6" ry="3.4" fill="#4e5b66" />
        <path d="M -2.5 26 l 0 3 M 2.5 26 l 0 3" />
    </g>
    <!-- A windmill on the plains -->
    <g
        transform="translate(70 1160) scale(0.95)"
        fill="none"
        stroke="#4e5b66"
        stroke-width="1.8"
        stroke-linecap="round"
    >
        <path
            d="M -13 36 L -3 -30 M 13 36 L 3 -30 M -11 22 L 11 22 M -8 4 L 8 4 M -6 -12 L 6 -12 M -11 22 L 8 4 M 11 22 L -8 4 M -8 4 L 6 -12 M 8 4 L -6 -12"
        />
        <circle cx="0" cy="-34" r="17" />
        <path
            d="M 0 -34 L 17.0 -34.0 M 0 -34 L 14.7 -25.5 M 0 -34 L 8.5 -19.3 M 0 -34 L 0.0 -17.0 M 0 -34 L -8.5 -19.3 M 0 -34 L -14.7 -25.5 M 0 -34 L -17.0 -34.0 M 0 -34 L -14.7 -42.5 M 0 -34 L -8.5 -48.7 M 0 -34 L -0.0 -51.0 M 0 -34 L 8.5 -48.7 M 0 -34 L 14.7 -42.5"
            stroke-width="1"
        />
        <path d="M 2 -34 L 34 -32 M 30 -38 L 40 -32 L 30 -26 Z" />
    </g>
    <!-- Pines in the Ozarks -->
    <g
        transform="translate(915 831) scale(1)"
        stroke="#4e5b66"
        stroke-width="1.6"
        stroke-linejoin="round"
    >
        <path
            d="M 0 -30 L 9 -16 L 4 -16 L 13 -3 L 6 -3 L 16 10 L -16 10 L -6 -3 L -13 -3 L -4 -16 L -9 -16 Z"
            fill="#4e5b66"
            fill-opacity="0.22"
        />
        <path d="M 0 10 L 0 18" stroke-width="2.4" />
    </g><g
        transform="translate(945 851) scale(0.8)"
        stroke="#4e5b66"
        stroke-width="1.6"
        stroke-linejoin="round"
    >
        <path
            d="M 0 -30 L 9 -16 L 4 -16 L 13 -3 L 6 -3 L 16 10 L -16 10 L -6 -3 L -13 -3 L -4 -16 L -9 -16 Z"
            fill="#4e5b66"
            fill-opacity="0.22"
        />
        <path d="M 0 10 L 0 18" stroke-width="2.4" />
    </g><g
        transform="translate(888 858) scale(0.75)"
        stroke="#4e5b66"
        stroke-width="1.6"
        stroke-linejoin="round"
    >
        <path
            d="M 0 -30 L 9 -16 L 4 -16 L 13 -3 L 6 -3 L 16 10 L -16 10 L -6 -3 L -13 -3 L -4 -16 L -9 -16 Z"
            fill="#4e5b66"
            fill-opacity="0.22"
        />
        <path d="M 0 10 L 0 18" stroke-width="2.4" />
    </g>
    <!-- Derricks on the Gulf coast -->
    <g
        transform="translate(868 1686) scale(0.9)"
        fill="none"
        stroke="#4e5b66"
        stroke-width="1.8"
        stroke-linecap="round"
    >
        <path
            d="M -14 34 L 0 -34 L 14 34 M -11 20 L 11 20 M -8 6 L 8 6 M -5 -8 L 5 -8 M -3 -20 L 3 -20 M -11 20 L 8 6 M 11 20 L -8 6 M -8 6 L 5 -8 M 8 6 L -5 -8 M -5 -8 L 3 -20 M 5 -8 L -3 -20"
        />
        <path d="M -4 -34 L 4 -34 M -20 34 L 20 34" />
    </g><g
        transform="translate(910 1702) scale(0.7)"
        fill="none"
        stroke="#4e5b66"
        stroke-width="1.8"
        stroke-linecap="round"
    >
        <path
            d="M -14 34 L 0 -34 L 14 34 M -11 20 L 11 20 M -8 6 L 8 6 M -5 -8 L 5 -8 M -3 -20 L 3 -20 M -11 20 L 8 6 M 11 20 L -8 6 M -8 6 L 5 -8 M 8 6 L -5 -8 M -5 -8 L 3 -20 M 5 -8 L -3 -20"
        />
        <path d="M -4 -34 L 4 -34 M -20 34 L 20 34" />
    </g>
    <!-- The Gulf -->
    <path
        d="M 821 1749 q 7 -6 14 0 t 14 0 M 867 1749 q 7 -6 14 0 t 14 0 M 913 1749 q 7 -6 14 0 t 14 0 M 959 1749 q 7 -6 14 0 t 14 0 M 843 1762 q 7 -6 14 0 t 14 0 M 889 1762 q 7 -6 14 0 t 14 0 M 935 1762 q 7 -6 14 0 t 14 0 "
        fill="none"
        stroke="#7f9bb0"
        stroke-width="1.6"
        stroke-linecap="round"
    />
    <!-- A compass rose under the rules -->
    <g transform="translate(1152 1535)">
        <circle r="50.839999999999996" fill="none" stroke="#4e5b66" stroke-width="1" />
        <circle r="45.88" fill="none" stroke="#4e5b66" stroke-width="0.6" stroke-dasharray="2 4" />
        <path d="M 0 0 L -9.9 -0.0 L 0.0 -62.0 Z" fill="#4e5b66" /><path
            d="M 0 0 L 9.9 -0.0 L 0.0 -62.0 Z"
            fill="#fbf6e7"
            stroke="#4e5b66"
            stroke-width="1"
        /><path d="M 0 0 L 0.0 -9.9 L 62.0 -0.0 Z" fill="#4e5b66" /><path
            d="M 0 0 L 0.0 9.9 L 62.0 -0.0 Z"
            fill="#fbf6e7"
            stroke="#4e5b66"
            stroke-width="1"
        /><path d="M 0 0 L 9.9 -0.0 L 0.0 62.0 Z" fill="#4e5b66" /><path
            d="M 0 0 L -9.9 0.0 L 0.0 62.0 Z"
            fill="#fbf6e7"
            stroke="#4e5b66"
            stroke-width="1"
        /><path d="M 0 0 L 0.0 9.9 L -62.0 0.0 Z" fill="#4e5b66" /><path
            d="M 0 0 L -0.0 -9.9 L -62.0 0.0 Z"
            fill="#fbf6e7"
            stroke="#4e5b66"
            stroke-width="1"
        /><path d="M 0 0 L -4.8 -4.8 L 26.3 -26.3 Z" fill="#4e5b66" /><path
            d="M 0 0 L 4.8 4.8 L 26.3 -26.3 Z"
            fill="#fbf6e7"
            stroke="#4e5b66"
            stroke-width="1"
        /><path d="M 0 0 L 4.8 -4.8 L 26.3 26.3 Z" fill="#4e5b66" /><path
            d="M 0 0 L -4.8 4.8 L 26.3 26.3 Z"
            fill="#fbf6e7"
            stroke="#4e5b66"
            stroke-width="1"
        /><path d="M 0 0 L 4.8 4.8 L -26.3 26.3 Z" fill="#4e5b66" /><path
            d="M 0 0 L -4.8 -4.8 L -26.3 26.3 Z"
            fill="#fbf6e7"
            stroke="#4e5b66"
            stroke-width="1"
        /><path d="M 0 0 L -4.8 4.8 L -26.3 -26.3 Z" fill="#4e5b66" /><path
            d="M 0 0 L 4.8 -4.8 L -26.3 -26.3 Z"
            fill="#fbf6e7"
            stroke="#4e5b66"
            stroke-width="1"
        />
        <text
            y="-70"
            text-anchor="middle"
            font-family="'Libre Baskerville', Georgia, serif"
            font-size="18"
            fill="#4e5b66">N</text
        >
    </g>
    <text x="1152" y="1739" class="gulf">Gulf of Mexico</text>
</g>

<style>
    /* The geography sits a fifth lighter than the first preview, so it never competes with track. */
    .geography {
        opacity: 0.8;
        pointer-events: none;
    }

    .state-line {
        fill: none;
        stroke: #8d8a80;
        stroke-width: 2;
        stroke-dasharray: 1 7;
        stroke-linecap: round;
        opacity: 0.9;
    }

    .river {
        fill: none;
        stroke: #7f9bb0;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.85;
    }

    .state {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        letter-spacing: 0.42em;
        fill: #8b97a0;
        text-anchor: middle;
    }

    .drawings {
        opacity: 0.62;
        pointer-events: none;
    }

    .gulf {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        font-style: italic;
        letter-spacing: 0.2em;
        fill: #4e5b66;
        text-anchor: middle;
    }
</style>

import flowbitePlugin from 'flowbite/plugin'
import { Config } from 'tailwindcss'
import path from 'path'

export default {
    content: [
        './src/**/*.{html,js,svelte,ts}',
        '../../node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}',
        '../../node_modules/@tabletop/fresh-fish-ui/**/*.{html,js,svelte,ts}',
        '../../node_modules/@tabletop/bridges-of-shangri-la-ui/**/*.{html,js,svelte,ts}',
        '../../node_modules/@tabletop/frontend-components/**/*.{html,js,svelte,ts}'
    ],

    theme: {
        extend: {
            colors: {
                // flowbite-svelte
                primary: {
                    50: '#FFF5F2',
                    100: '#FFF1EE',
                    200: '#FFE4DE',
                    300: '#FFD5CC',
                    400: '#FFBCAD',
                    500: '#FE795D',
                    600: '#EF562F',
                    700: '#EB4F27',
                    800: '#CC4522',
                    900: '#A5371B'
                }
            }
        }
    },

    plugins: [flowbitePlugin],
    darkMode: 'class'
} as Config

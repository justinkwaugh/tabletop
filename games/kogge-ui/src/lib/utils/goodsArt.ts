import { Good } from '@tabletop/kogge'

export interface GoodArt {
    name: string
    fill: string
    light: string
    dark: string
    ink: string
}

export const GOOD_ART: Record<Good, GoodArt> = {
    [Good.Ore]: { name: 'Ore', fill: '#7d8187', light: '#a3a7ac', dark: '#55595e', ink: '#f3d65a' },
    [Good.Fur]: { name: 'Fur', fill: '#e2652b', light: '#f2925a', dark: '#a8431a', ink: '#f8de5c' },
    [Good.Amber]: {
        name: 'Amber',
        fill: '#743589',
        light: '#9a5bb0',
        dark: '#4f2060',
        ink: '#f6d860'
    },
    [Good.Salt]: {
        name: 'Salt',
        fill: '#f3efe2',
        light: '#ffffff',
        dark: '#c9c2ad',
        ink: '#b3262b'
    }
}

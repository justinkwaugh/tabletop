export type CompanyDeedTextLayout = {
    lines?: readonly string[]
    textXRatio?: number
    textYRatio?: number
    textSizeRatio?: number
    textLineHeightRatio?: number
}

const DEED_TEXT_LAYOUT_BY_KEY: Readonly<Record<string, CompanyDeedTextLayout>> = {
    D01: {
        lines: ['Halmahera'],
        textSizeRatio: 0.18
    },
    D02: {
        lines: ['Maluku'],
        textXRatio: 0.47
    },
    D03: {
        lines: ['Jawa', 'Barat'],
        textXRatio: 0.51
    },
    D04: {
        lines: ['Bali'],
        textXRatio: 0.55
    },
    D05: {
        lines: ['Jawa', 'Timur'],
        textXRatio: 0.6
    },
    D06: {
        lines: ['Lampung'],
        textXRatio: 0.43,
        textYRatio: 0.3
    },
    D07: {
        lines: ['Sulawesi', 'Selatan'],
        textSizeRatio: 0.19,
        textYRatio: 0.43,
        textXRatio: 0.5
    },
    D08: {
        lines: ['Halmahera'],
        textSizeRatio: 0.18
    },
    D09: {
        lines: ['Aceh']
    },
    D10: {
        lines: ['Kalimantan', 'Timur'],
        textSizeRatio: 0.2,
        textYRatio: 0.46
    },
    D11: {
        lines: ['Riau'],
        textXRatio: 0.55
    },
    D12: {
        lines: ['Sumatera', 'Barat'],
        textSizeRatio: 0.21,
        textXRatio: 0.47
    },
    D13: {
        lines: ['Kalimantan', 'Barat'],
        textSizeRatio: 0.185,
        textXRatio: 0.5,
        textYRatio: 0.43
    },
    D14: {
        lines: ['Sulawesi', 'Tengah'],
        textSizeRatio: 0.22,
        textXRatio: 0.5,
        textYRatio: 0.43
    },
    D15: {
        lines: ['Jawa', 'Tengah'],
        textXRatio: 0.51
    },
    D16: {
        lines: ['Sumatera', 'Utara'],
        textSizeRatio: 0.2,
        textXRatio: 0.5,
        textYRatio: 0.43
    },
    D17: {
        lines: ['Jawa', 'Barat'],
        textXRatio: 0.55
    },
    D18: {
        lines: ['Sulawesi', 'Tenggara'],
        textSizeRatio: 0.2,
        textXRatio: 0.45,
        textYRatio: 0.43
    },
    D19: {
        lines: ['Sumatera', 'Selatan'],
        textSizeRatio: 0.2,
        textXRatio: 0.48,
        textYRatio: 0.43
    },
    D20: {
        lines: ['Papua'],
        textXRatio: 0.51
    },
    D21: {
        lines: ['Kalimantan', 'Selatan'],
        textSizeRatio: 0.2,
        textXRatio: 0.45,
        textYRatio: 0.43
    },
    D22: {
        lines: ['Sarawak'],
        textXRatio: 0.39,
        textYRatio: 0.47
    },
    D23: {
        lines: ['Maluku'],
        textXRatio: 0.45,
        textYRatio: 0.47
    },
    D24: {
        lines: ['Papua'],
        textXRatio: 0.5,
        textYRatio: 0.45
    }
}

export function deedTextLayoutForKeys(keys: readonly string[]): CompanyDeedTextLayout | null {
    for (const key of keys) {
        const layout = DEED_TEXT_LAYOUT_BY_KEY[key]
        if (layout) {
            return layout
        }
    }

    return null
}

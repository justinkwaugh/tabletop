import { Font, Link, Section } from '@react-email/components'
import type { CSSProperties } from 'react'

// The dark card look shared by the emails that carry the site's wordmark: tournament results
// and bug report updates.

export const darkPalette = {
    canvas: '#111827',
    card: '#1f2937',
    cardBorder: '#374151',
    raised: '#293950',
    raisedBorder: '#6496df80',
    text: '#f9fafb',
    muted: '#9ca3af',
    faint: '#6b7280',
    blue: '#93c5fd',
    brandBlue: '#4a7fd0',
    button: '#2563eb',
    buttonBorder: '#3b82f6',
}

export const fontStack =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

export const darkStyles = {
    body: {
        margin: 0,
        padding: 0,
        backgroundColor: darkPalette.canvas,
        fontFamily: fontStack,
        WebkitFontSmoothing: 'antialiased',
    },
    container: { maxWidth: '600px', margin: '0 auto', padding: '32px 16px' },
    card: {
        backgroundColor: darkPalette.card,
        border: `1px solid ${darkPalette.cardBorder}`,
        borderRadius: '12px',
        padding: '32px 32px 28px',
    },
    eyebrow: {
        margin: 0,
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: darkPalette.blue,
    },
    heading: {
        margin: '10px 0 6px',
        fontSize: '30px',
        lineHeight: '1.1',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: darkPalette.text,
    },
    subline: { margin: 0, fontSize: '15px', lineHeight: '1.6', color: darkPalette.muted },
    button: {
        display: 'inline-block',
        backgroundColor: darkPalette.button,
        border: `1px solid ${darkPalette.buttonBorder}`,
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 600,
        lineHeight: '20px',
        padding: '13px 24px',
        textDecoration: 'none',
    },
    footer: { margin: 0, fontSize: '12px', lineHeight: '1.6', color: darkPalette.faint },
    footerLink: { color: darkPalette.muted, textDecoration: 'underline' },
} satisfies Record<string, CSSProperties>

const wordmarkStyles = {
    section: { textAlign: 'center', padding: '0 0 20px' },
    board: {
        fontSize: '18px',
        fontWeight: 800,
        letterSpacing: '0.04em',
        color: darkPalette.brandBlue,
        textDecoration: 'none',
    },
    together: {
        fontSize: '18px',
        fontWeight: 300,
        letterSpacing: '0.04em',
        color: darkPalette.muted,
        textDecoration: 'none',
    },
} satisfies Record<string, CSSProperties>

// Goes inside <Head>: the dark colour scheme and the Inter web font.
export const DarkHeadContent = () => (
    <>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
        <Font
            fontFamily="Inter"
            fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
            webFont={{
                url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2',
                format: 'woff2',
            }}
            fontWeight={400}
            fontStyle="normal"
        />
    </>
)

export const Wordmark = ({ href }: { href: string }) => (
    <Section style={wordmarkStyles.section}>
        <Link href={href} style={wordmarkStyles.board}>
            BOARD
        </Link>
        <Link href={href} style={wordmarkStyles.together}>
            {' '}
            TOGETHER
        </Link>
    </Section>
)

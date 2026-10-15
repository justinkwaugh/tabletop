import {
    Body,
    Button,
    Container,
    Font,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text,
} from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'

const SITE_URL = 'https://boardtogether.games'

export const darkPalette = {
    canvas: '#111827',
    card: '#1f2937',
    cardBorder: '#374151',
    raised: '#293950',
    raisedBorder: '#6496df80',
    text: '#f9fafb',
    bodyText: '#d1d5db',
    muted: '#9ca3af',
    faint: '#6b7280',
    blue: '#93c5fd',
    brandBlue: '#4a7fd0',
    gold: '#fbbf24',
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
        margin: '0 0 10px',
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: darkPalette.blue,
    },
    heading: {
        margin: '0 0 6px',
        fontSize: '30px',
        lineHeight: '1.1',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: darkPalette.text,
    },
    subline: { margin: 0, fontSize: '15px', lineHeight: '1.6', color: darkPalette.muted },
    panel: {
        marginTop: '24px',
        backgroundColor: darkPalette.raised,
        border: `1px solid ${darkPalette.raisedBorder}`,
        borderRadius: '10px',
        padding: '18px 20px',
    },
    panelValue: {
        margin: 0,
        fontSize: '20px',
        lineHeight: '1.3',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        color: darkPalette.text,
    },
    panelDetail: {
        margin: '4px 0 0',
        fontSize: '14px',
        lineHeight: '1.5',
        color: darkPalette.bodyText,
    },
    buttonRow: { textAlign: 'center', padding: '28px 0 8px' },
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
    rule: { borderColor: darkPalette.cardBorder, margin: '24px 0 16px' },
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

const Wordmark = ({ href }: { href: string }) => (
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

interface DarkCardEmailProps {
    preview: string
    // Where the wordmark goes; the site's home page when the email has no page of its own.
    wordmarkHref?: string
    eyebrow?: string
    heading: ReactNode
    subline: ReactNode
    footer: ReactNode
    children?: ReactNode
}

export const DarkCardEmail = ({
    preview,
    wordmarkHref = SITE_URL,
    eyebrow,
    heading,
    subline,
    footer,
    children,
}: DarkCardEmailProps) => (
    <Html>
        <Head>
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
        </Head>
        <Preview>{preview}</Preview>
        <Body style={darkStyles.body}>
            <Container style={darkStyles.container}>
                <Wordmark href={wordmarkHref} />

                <Section style={darkStyles.card}>
                    {eyebrow && <Text style={darkStyles.eyebrow}>{eyebrow}</Text>}
                    <Heading as="h1" style={darkStyles.heading}>
                        {heading}
                    </Heading>
                    <Text style={darkStyles.subline}>{subline}</Text>
                    {children}
                </Section>

                <Hr style={darkStyles.rule} />
                <Text style={darkStyles.footer}>{footer}</Text>
            </Container>
        </Body>
    </Html>
)

export const CardButton = ({ href, children }: { href: string; children: ReactNode }) => (
    <Section style={darkStyles.buttonRow}>
        <Button href={href} style={darkStyles.button}>
            {children}
        </Button>
    </Section>
)

export const ButtonFallback = ({ url }: { url: string }) => (
    <>
        If the button does not work, open{' '}
        <Link href={url} style={darkStyles.footerLink}>
            {url}
        </Link>
        .
    </>
)

export const formatNames = (names: string[], whenEmpty: string): string => {
    if (names.length === 0) return whenEmpty
    if (names.length === 1) return names[0]
    if (names.length === 2) return `${names[0]} and ${names[1]}`
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

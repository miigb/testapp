/**
 * Status display components — pill badge and icon renderer.
 * Entity identity components — logo, avatar, and combined entity display.
 */
import {
    AlertTriangle,
    Ban,
    CheckCircle2,
    Circle,
    Clock3,
    FileClock,
    FileSearch,
    Hammer,
    Minus,
    OctagonAlert,
    ReceiptText,
    SearchCheck,
    ShieldAlert,
    UserRound,
} from 'lucide-react'
import { useState } from 'react'
import type { StatusDefinition } from '../../types'
import { colorWithAlpha, normalizeText } from '../../lib/formatters'

// ---- Domain map for logo lookups (extracted from App.tsx) ---------------

const LOGO_DEV_TOKEN = (import.meta.env.VITE_LOGO_DEV_TOKEN as string | undefined) ?? 'pk_J_6gnc2JTzKtdVlXmGyzvA'

const EXEQUENTE_DOMAIN_MAP: Record<string, string> = {
    MONTEPIO: 'montepio.pt',
    CGD: 'cgd.pt',
    'CGD.': 'cgd.pt',
    CAIXA: 'cgd.pt',
    'CAIXA GERAL': 'cgd.pt',
    'CAIXA GERL': 'cgd.pt',
    CGA: 'cgd.pt',
    SANTANDER: 'santander.pt',
    'SANTANDER -SPS': 'santander.pt',
    BCP: 'millenniumbcp.pt',
    'NOVO BANCO': 'novobanco.pt',
    BPI: 'bancobpi.pt',
    CREDIBOM: 'credibom.pt',
    SERVDEBT: 'servdebt.com',
    SERVDBET: 'servdebt.com',
    EOS: 'eos-solutions.pt',
    'DUO CAPITAL': 'duocapital.com',
    NOS: 'nos.pt',
    ORTHONAVE: 'orthonave.pt',
    DOCAPESCA: 'docapesca.pt',
    'DATA REDE': 'datarede.pt',
    'ARES LUSITANI': 'areslusitani.pt',
    'LC ASSET': 'lcasset.pt',
    RCI: 'rcibankandservices.com',
    ZARCO: 'zarco.pt',
    ALGEBRA: 'algebra-capital.com',
    HEFESTO: 'hefesto.pt',
    HEFETO: 'hefesto.pt',
    HEFETSO: 'hefesto.pt',
    HESFESTO: 'hefesto.pt',
    BTL: 'btlireland.com',
    'BTL IRELAND': 'btlireland.com',
}

const EXEQUENTE_KEYWORD_DOMAIN: Array<{ keyword: string; domain: string }> = [
    { keyword: 'SANTANDER', domain: 'santander.pt' },
    { keyword: 'MONTEPIO', domain: 'montepio.pt' },
    { keyword: 'CAIXA', domain: 'cgd.pt' },
    { keyword: 'CGD', domain: 'cgd.pt' },
    { keyword: 'SERVDEBT', domain: 'servdebt.com' },
    { keyword: 'CREDIBOM', domain: 'credibom.pt' },
    { keyword: 'EOS', domain: 'eos-solutions.pt' },
    { keyword: 'NOVO BANCO', domain: 'novobanco.pt' },
    { keyword: 'BPI', domain: 'bancobpi.pt' },
    { keyword: 'BCP', domain: 'millenniumbcp.pt' },
    { keyword: 'NOS', domain: 'nos.pt' },
]

function getExequenteLogoUrl(name?: string): string | undefined {
    if (!name || !LOGO_DEV_TOKEN) return undefined

    const normalized = normalizeText(name)

    if (/^[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(name.trim())) {
        return `https://img.logo.dev/${name.trim().toLowerCase()}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=64&format=png`
    }

    const mappedDomain = EXEQUENTE_DOMAIN_MAP[normalized]
    if (mappedDomain) {
        return `https://img.logo.dev/${mappedDomain}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=64&format=png`
    }

    const keywordMatch = EXEQUENTE_KEYWORD_DOMAIN.find((entry) => normalized.includes(entry.keyword))
    if (keywordMatch) {
        return `https://img.logo.dev/${keywordMatch.domain}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=64&format=png`
    }

    return undefined
}

// ---- StatusIcon ---------------------------------------------------------

type StatusIconProps = {
    name: string
    size?: number
}

export function StatusIcon({ name, size = 14 }: StatusIconProps) {
    if (name === 'hammer') return <Hammer size={size} />
    if (name === 'clock3') return <Clock3 size={size} />
    if (name === 'search-check') return <SearchCheck size={size} />
    if (name === 'receipt-text') return <ReceiptText size={size} />
    if (name === 'octagon-alert') return <OctagonAlert size={size} />
    if (name === 'check-circle2') return <CheckCircle2 size={size} />
    if (name === 'shield-alert') return <ShieldAlert size={size} />
    if (name === 'file-search') return <FileSearch size={size} />
    if (name === 'file-clock') return <FileClock size={size} />
    if (name === 'ban') return <Ban size={size} />
    if (name === 'alert-triangle') return <AlertTriangle size={size} />
    return <Circle size={size} />
}

// ---- StatusPill ---------------------------------------------------------

type StatusPillProps = {
    status: StatusDefinition
    compact?: boolean
}

export function StatusPill({ status, compact }: StatusPillProps) {
    return (
        <span
            className={`status-pill ${compact ? 'compact' : ''}`}
            style={{ borderColor: status.color, backgroundColor: colorWithAlpha(status.color, '26') }}
        >
            <StatusIcon name={status.icon} size={14} />
            {!compact && <span>{status.label}</span>}
        </span>
    )
}

// ---- ExequenteLogo ------------------------------------------------------

type ExequenteLogoProps = {
    name?: string
    size?: number
}

export function ExequenteLogo({ name, size = 18 }: ExequenteLogoProps) {
    const [hasError, setHasError] = useState(false)
    const logoUrl = getExequenteLogoUrl(name)
    const letter = name?.trim().charAt(0)?.toUpperCase() || '•'

    if (!logoUrl || hasError) {
        return (
            <span className="logo-fallback" style={{ width: size, height: size }}>
                {letter}
            </span>
        )
    }

    return (
        <img
            className="exequente-logo"
            src={logoUrl}
            alt={name ?? 'Logo exequente'}
            width={size}
            height={size}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
        />
    )
}

// ---- GestorAvatar -------------------------------------------------------

export function GestorAvatar({ gestor, size = 18 }: { gestor?: string; size?: number }) {
    const initial = gestor?.trim()?.charAt(0)?.toUpperCase()
    return (
        <span className="gestor-avatar" style={{ width: size, height: size }}>
            {initial || <UserRound size={Math.max(11, size - 6)} />}
        </span>
    )
}

// ---- EntityIdentity -----------------------------------------------------

type EntityIdentityProps = {
    gestor?: string
    exequente?: string
}

export function EntityIdentity({ gestor, exequente }: EntityIdentityProps) {
    const gestorValue = gestor?.trim()
    const exequenteValue = exequente?.trim()
    const label = gestorValue || exequenteValue

    if (gestorValue) {
        return (
            <span className="entity-with-logo">
                <GestorAvatar gestor={gestorValue} />
                <span>{label}</span>
            </span>
        )
    }

    if (!exequenteValue) {
        return (
            <span className="entity-with-logo entity-empty" aria-label="Sem entidade">
                <span className="entity-empty-icon">
                    <Minus size={11} />
                </span>
            </span>
        )
    }

    return (
        <span className="entity-with-logo">
            <ExequenteLogo name={exequenteValue} />
            <span>{exequenteValue}</span>
        </span>
    )
}

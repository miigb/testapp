/**
 * Shared form input components — pure UI, no data fetching.
 */
import { useMemo, useRef, useState } from 'react'
import { normalizeText } from '../../lib/formatters'

// ---- LabeledInput -------------------------------------------------------

type LabeledInputProps = {
    label: string
    value: string
    onChange: (value: string) => void
    type?: 'text' | 'date' | 'number'
    suggestions?: string[]
    placeholder?: string
}

export function LabeledInput({ label, value, onChange, type = 'text', suggestions, placeholder }: LabeledInputProps) {
    return (
        <label className="field">
            <span>{label}</span>
            {type === 'text' && Array.isArray(suggestions) && suggestions.length > 0 ? (
                <AutocompleteInput value={value} onChange={onChange} suggestions={suggestions} placeholder={placeholder} />
            ) : (
                <input
                    type={type}
                    value={value}
                    placeholder={placeholder}
                    onChange={(event) => onChange(event.target.value)}
                />
            )}
        </label>
    )
}

// ---- AutocompleteInput --------------------------------------------------

type AutocompleteInputProps = {
    value: string
    onChange: (value: string) => void
    suggestions: string[]
    placeholder?: string
}

export function AutocompleteInput({ value, onChange, suggestions, placeholder }: AutocompleteInputProps) {
    const [open, setOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement | null>(null)

    const filtered = useMemo(() => {
        const unique = [...new Set(suggestions.map((item) => item.trim()).filter(Boolean))]
        const query = normalizeText(value)

        if (!query) return unique.slice(0, 160)

        const startsWith = unique.filter((item) => normalizeText(item).startsWith(query))
        const contains = unique.filter((item) => !normalizeText(item).startsWith(query) && normalizeText(item).includes(query))
        return [...startsWith, ...contains].slice(0, 160)
    }, [suggestions, value])

    function commitSelection(nextValue: string) {
        onChange(nextValue)
        setOpen(false)
        setHighlightedIndex(-1)
    }

    return (
        <div className="autocomplete-input">
            <input
                ref={inputRef}
                type="text"
                value={value}
                placeholder={placeholder}
                autoComplete="off"
                onFocus={() => setOpen(true)}
                onBlur={() => {
                    window.setTimeout(() => {
                        setOpen(false)
                        setHighlightedIndex(-1)
                    }, 110)
                }}
                onChange={(event) => {
                    onChange(event.target.value)
                    setOpen(true)
                    setHighlightedIndex(-1)
                }}
                onKeyDown={(event) => {
                    if (!open || filtered.length === 0) return

                    if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        setHighlightedIndex((current) => (current + 1 >= filtered.length ? 0 : current + 1))
                        return
                    }

                    if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        setHighlightedIndex((current) => (current <= 0 ? filtered.length - 1 : current - 1))
                        return
                    }

                    if (event.key === 'Enter') {
                        if (highlightedIndex >= 0) {
                            event.preventDefault()
                            commitSelection(filtered[highlightedIndex])
                        }
                        return
                    }

                    if (event.key === 'Escape') {
                        setOpen(false)
                        setHighlightedIndex(-1)
                    }
                }}
            />
            {open && filtered.length > 0 && (
                <div className="autocomplete-menu" role="listbox">
                    {filtered.map((option, index) => (
                        <button
                            key={`${option}-${index}`}
                            type="button"
                            className={`autocomplete-option ${highlightedIndex === index ? 'active' : ''}`}
                            onMouseDown={(event) => {
                                event.preventDefault()
                                commitSelection(option)
                            }}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ---- LabeledSelect ------------------------------------------------------

type LabeledSelectProps = {
    label: string
    value: string
    onChange: (value: string) => void
    options: { value: string; label: string }[]
}

export function LabeledSelect({ label, value, onChange, options }: LabeledSelectProps) {
    return (
        <label className="field">
            <span>{label}</span>
            <select value={value} onChange={(event) => onChange(event.target.value)}>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    )
}

// ---- Info (label/value display row) ------------------------------------

type InfoProps = {
    label: string
    value: string
}

export function Info({ label, value }: InfoProps) {
    return (
        <div className="info-row">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    )
}

import { useState, useMemo, useEffect } from 'react'
import { evaluateSmartNotesLine } from '../lib/smartNotes'
import type { SmartNotesResultRow, SmartNotesErrorRow, SavedSmartNotesEntry } from '../lib/smartNotes'
import {
    resolveInitialSmartNotes,
    resolveInitialSmartNotesPinnedSignatures,
    resolveInitialSmartNotesSavedEntries,
} from '../lib/localStorage'

export function useSmartNotes() {
    const [smartNotesText, setSmartNotesText] = useState(resolveInitialSmartNotes)
    const [smartNotesPinnedSignatures, setSmartNotesPinnedSignatures] = useState<string[]>(
        resolveInitialSmartNotesPinnedSignatures,
    )
    const [smartNotesSavedEntries, setSmartNotesSavedEntries] = useState<SavedSmartNotesEntry[]>(
        resolveInitialSmartNotesSavedEntries,
    )

    const smartNotesEvaluation = useMemo(() => {
        const context = {
            previousResults: [] as number[],
            variables: new Map<string, number>(),
        }
        const results: SmartNotesResultRow[] = []
        const errors: SmartNotesErrorRow[] = []

        for (const [index, line] of smartNotesText.split('\n').entries()) {
            const parsed = evaluateSmartNotesLine(line, context)
            if (!parsed) continue

            if ('error' in parsed) {
                errors.push({
                    lineNumber: index + 1,
                    source: line.trim(),
                    error: parsed.error,
                })
                continue
            }

            context.previousResults.push(parsed.result)
            if (parsed.variableKey) {
                context.variables.set(parsed.variableKey, parsed.result)
            }

            results.push({
                lineNumber: index + 1,
                source: line.trim(),
                expression: parsed.expression,
                result: parsed.result,
                signature: parsed.signature,
            })
        }

        return { results, errors }
    }, [smartNotesText])

    const smartNotesResults = smartNotesEvaluation.results
    const smartNotesErrors = smartNotesEvaluation.errors
    const smartNotesPinnedSet = useMemo(() => new Set(smartNotesPinnedSignatures), [smartNotesPinnedSignatures])
    const smartNotesSavedSet = useMemo(
        () => new Set(smartNotesSavedEntries.map((entry) => entry.signature)),
        [smartNotesSavedEntries],
    )
    const smartNotesDisplayResults = useMemo(() => {
        return [...smartNotesResults].sort((a, b) => {
            const aPinned = smartNotesPinnedSet.has(a.signature) ? 1 : 0
            const bPinned = smartNotesPinnedSet.has(b.signature) ? 1 : 0
            if (aPinned !== bPinned) return bPinned - aPinned
            return a.lineNumber - b.lineNumber
        })
    }, [smartNotesResults, smartNotesPinnedSet])

    useEffect(() => {
        localStorage.setItem('mesa-recibos-smart-notes', smartNotesText)
    }, [smartNotesText])

    useEffect(() => {
        localStorage.setItem('mesa-recibos-smart-notes-pinned', JSON.stringify(smartNotesPinnedSignatures))
    }, [smartNotesPinnedSignatures])

    useEffect(() => {
        localStorage.setItem('mesa-recibos-smart-notes-saved', JSON.stringify(smartNotesSavedEntries.slice(0, 200)))
    }, [smartNotesSavedEntries])

    return {
        smartNotesText,
        setSmartNotesText,
        smartNotesPinnedSignatures,
        setSmartNotesPinnedSignatures,
        smartNotesSavedEntries,
        setSmartNotesSavedEntries,
        smartNotesResults,
        smartNotesErrors,
        smartNotesPinnedSet,
        smartNotesSavedSet,
        smartNotesDisplayResults,
    }
}

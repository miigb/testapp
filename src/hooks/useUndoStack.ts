import { useState, useCallback } from 'react'

export type UndoAction = {
    id: string
    label: string
    run: () => Promise<void>
}

export interface UseUndoStackOptions {
    onUndoSuccess?: (label: string) => Promise<void> | void
    onUndoError?: (error: Error) => void
}

export function useUndoStack(options?: UseUndoStackOptions) {
    const [undoStack, setUndoStack] = useState<UndoAction[]>([])

    const pushUndo = useCallback((action: Omit<UndoAction, 'id'>) => {
        setUndoStack((prev) => {
            const next = [...prev, { ...action, id: crypto.randomUUID() }]
            return next.slice(-20)
        })
    }, [])

    const handleUndo = useCallback(async () => {
        const action = undoStack[undoStack.length - 1]
        if (!action) return

        setUndoStack((prev) => prev.slice(0, -1))

        try {
            await action.run()
            if (options?.onUndoSuccess) {
                await options.onUndoSuccess(action.label)
            }
        } catch (error) {
            if (options?.onUndoError) {
                options.onUndoError(error instanceof Error ? error : new Error('Unknown error'))
            }
        }
    }, [undoStack, options])

    const dismissUndo = useCallback(() => {
        setUndoStack((prev) => prev.slice(0, -1))
    }, [])

    return {
        undoStack,
        pushUndo,
        handleUndo,
        dismissUndo,
    }
}

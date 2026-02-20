import { useState, useRef, useEffect, useCallback } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { QuickToolId } from '../constants'

export function useQuickTools(evaluateCalculator: () => void) {
    const [toolsExpanded, setToolsExpanded] = useState(false)
    const [notesOpen, setNotesOpen] = useState(false)
    const [calculatorOpen, setCalculatorOpen] = useState(false)
    const [smartNotesOpen, setSmartNotesOpen] = useState(false)
    const [toolPinned, setToolPinned] = useState<Record<QuickToolId, boolean>>({
        notes: false,
        calculator: false,
        'smart-notes': false,
    })
    const [toolLayers, setToolLayers] = useState<Record<QuickToolId, number>>({
        notes: 1,
        calculator: 2,
        'smart-notes': 3,
    })
    const [toolPositions, setToolPositions] = useState<Record<QuickToolId, { x: number; y: number } | null>>({
        notes: null,
        calculator: null,
        'smart-notes': null,
    })
    const [draggingTool, setDraggingTool] = useState<QuickToolId | null>(null)

    const toolLayerRef = useRef(4)
    const toolDragRef = useRef<{ tool: QuickToolId; pointerOffsetX: number; pointerOffsetY: number } | null>(null)

    const notesWindowRef = useRef<HTMLDivElement>(null)
    const calculatorWindowRef = useRef<HTMLDivElement>(null)
    const smartNotesWindowRef = useRef<HTMLDivElement>(null)

    const bringToolToFront = useCallback((tool: QuickToolId) => {
        setToolLayers((current) => {
            const layers = Object.values(current)
            const max = Math.max(...layers)
            if (current[tool] === max) return current
            return { ...current, [tool]: max + 1 }
        })
    }, [])

    const toggleQuickTool = useCallback((tool: QuickToolId) => {
        setToolsExpanded(true)
        const isOpen = tool === 'notes' ? notesOpen : tool === 'calculator' ? calculatorOpen : smartNotesOpen
        if (isOpen) {
            if (tool === 'notes') setNotesOpen(false)
            else if (tool === 'calculator') setCalculatorOpen(false)
            else setSmartNotesOpen(false)

            if (toolDragRef.current?.tool === tool) {
                toolDragRef.current = null
                setDraggingTool(null)
            }
            return
        }

        if (tool === 'notes') setNotesOpen(true)
        else if (tool === 'calculator') setCalculatorOpen(true)
        else setSmartNotesOpen(true)

        setToolLayers((current) => {
            const nextLayer = toolLayerRef.current++
            return { ...current, [tool]: nextLayer }
        })
    }, [calculatorOpen, notesOpen, smartNotesOpen])

    const toggleQuickToolPinned = useCallback((tool: QuickToolId) => {
        setToolPinned((current) => ({ ...current, [tool]: !current[tool] }))
        setToolLayers((current) => {
            const nextLayer = toolLayerRef.current++
            return { ...current, [tool]: nextLayer }
        })
    }, [])

    const getToolWindowElement = useCallback((tool: QuickToolId): HTMLDivElement | null => {
        if (tool === 'notes') return notesWindowRef.current
        if (tool === 'calculator') return calculatorWindowRef.current
        return smartNotesWindowRef.current
    }, [])

    const startToolWindowDrag = useCallback((tool: QuickToolId, event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.button !== 0) return
        const element = getToolWindowElement(tool)
        if (!element) return

        bringToolToFront(tool)
        const rect = element.getBoundingClientRect()
        setToolPositions((current) => ({ ...current, [tool]: { x: rect.left, y: rect.top } }))
        toolDragRef.current = {
            tool,
            pointerOffsetX: event.clientX - rect.left,
            pointerOffsetY: event.clientY - rect.top,
        }
        setDraggingTool(tool)
        event.preventDefault()
    }, [bringToolToFront, getToolWindowElement])

    useEffect(() => {
        if (!draggingTool) return

        function handleToolWindowMouseMove(event: MouseEvent) {
            const dragState = toolDragRef.current
            if (!dragState) return
            const element = getToolWindowElement(dragState.tool)
            if (!element) return

            const margin = 10
            const width = element.offsetWidth
            const height = element.offsetHeight
            const maxX = Math.max(margin, window.innerWidth - width - margin)
            const maxY = Math.max(margin, window.innerHeight - height - margin)
            const rawX = event.clientX - dragState.pointerOffsetX
            const rawY = event.clientY - dragState.pointerOffsetY
            const nextX = Math.min(maxX, Math.max(margin, rawX))
            const nextY = Math.min(maxY, Math.max(margin, rawY))

            setToolPositions((current) => ({ ...current, [dragState.tool]: { x: nextX, y: nextY } }))
        }

        function stopToolWindowDrag() {
            toolDragRef.current = null
            setDraggingTool(null)
        }

        window.addEventListener('mousemove', handleToolWindowMouseMove)
        window.addEventListener('mouseup', stopToolWindowDrag, { once: true })
        return () => {
            window.removeEventListener('mousemove', handleToolWindowMouseMove)
            window.removeEventListener('mouseup', stopToolWindowDrag)
        }
    }, [draggingTool, getToolWindowElement])

    useEffect(() => {
        if (!notesOpen && !calculatorOpen && !smartNotesOpen) return

        function handleQuickToolKeyboard(event: KeyboardEvent) {
            const target = event.target as HTMLElement | null
            const isEditableTarget =
                target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable === true

            if (event.key === 'Escape') {
                event.preventDefault()
                const openTools: QuickToolId[] = []
                if (notesOpen) openTools.push('notes')
                if (calculatorOpen) openTools.push('calculator')
                if (smartNotesOpen) openTools.push('smart-notes')
                const topTool = openTools.sort((a, b) => toolLayers[b] - toolLayers[a])[0]
                if (topTool === 'notes') {
                    setNotesOpen(false)
                } else if (topTool === 'calculator') {
                    setCalculatorOpen(false)
                } else if (topTool === 'smart-notes') {
                    setSmartNotesOpen(false)
                }
                return
            }

            if (event.key === 'Enter' && calculatorOpen && !isEditableTarget) {
                event.preventDefault()
                evaluateCalculator()
            }
        }

        window.addEventListener('keydown', handleQuickToolKeyboard)
        return () => {
            window.removeEventListener('keydown', handleQuickToolKeyboard)
        }
    }, [notesOpen, calculatorOpen, smartNotesOpen, evaluateCalculator, toolLayers])

    const notesWindowZIndex = (toolPinned.notes ? 2600 : 1700) + toolLayers.notes
    const calculatorWindowZIndex = (toolPinned.calculator ? 2600 : 1700) + toolLayers.calculator
    const smartNotesWindowZIndex = (toolPinned['smart-notes'] ? 2600 : 1700) + toolLayers['smart-notes']

    return {
        toolsExpanded,
        setToolsExpanded,
        notesOpen,
        setNotesOpen,
        calculatorOpen,
        setCalculatorOpen,
        smartNotesOpen,
        setSmartNotesOpen,
        toolPinned,
        toolLayers,
        toolPositions,
        draggingTool,
        notesWindowRef,
        calculatorWindowRef,
        smartNotesWindowRef,
        bringToolToFront,
        toggleQuickTool,
        toggleQuickToolPinned,
        startToolWindowDrag,
        notesWindowZIndex,
        calculatorWindowZIndex,
        smartNotesWindowZIndex,
    }
}

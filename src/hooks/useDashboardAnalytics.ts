import { useMemo } from 'react'
import type { DsRecord, PenhorasRecord, StatusDefinition } from '../types'
import { formatCurrency, normalizeText } from '../lib/formatters'
import { MONTHS } from '../constants'

function getStatus(statuses: StatusDefinition[], statusId?: string): StatusDefinition | undefined {
  if (!statusId) return undefined
  return statuses.find((status) => status.id === statusId)
}

interface UseDashboardAnalyticsParams {
  dsRecords: DsRecord[]
  dsStatuses: StatusDefinition[]
  penhorasRecords: PenhorasRecord[]
  penhorasStatuses: StatusDefinition[]
}

export function useDashboardAnalytics({ dsRecords, dsStatuses, penhorasRecords, penhorasStatuses }: UseDashboardAnalyticsParams) {
  const dsDashboardTotals = useMemo(() => {
    let valor = 0
    let comissaoLoja = 0
    let totalComissaoLojaCmIva = 0
    let comissaoGestor = 0
    let comRecibo = 0

    for (const record of dsRecords) {
      if (typeof record.valor === 'number') valor += record.valor
      if (typeof record.comissaoLoja === 'number') comissaoLoja += record.comissaoLoja
      if (typeof record.totalComissaoLojaCmIva === 'number') totalComissaoLojaCmIva += record.totalComissaoLojaCmIva
      if (typeof record.comissaoGestor === 'number') comissaoGestor += record.comissaoGestor
      if (record.recibo?.trim()) comRecibo += 1
    }

    return {
      registos: dsRecords.length,
      valor,
      comissaoLoja,
      totalComissaoLojaCmIva,
      comissaoGestor,
      comRecibo,
      semRecibo: Math.max(0, dsRecords.length - comRecibo),
    }
  }, [dsRecords])

  const dsDashboardByStatus = useMemo(() => {
    const buckets = new Map<string, { count: number; total: number }>()
    for (const record of dsRecords) {
      const key = record.estadoId || 'sem-estado'
      const current = buckets.get(key) ?? { count: 0, total: 0 }
      current.count += 1
      const value = record.totalComissaoLojaCmIva ?? record.comissaoLoja ?? record.valor ?? 0
      if (typeof value === 'number') current.total += value
      buckets.set(key, current)
    }

    return [...buckets.entries()]
      .map(([statusId, bucket]) => {
        const status = getStatus(dsStatuses, statusId)
        return {
          id: statusId,
          label: status?.label ?? 'Sem estado',
          value: bucket.count,
          secondary: formatCurrency(bucket.total),
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [dsRecords, dsStatuses])

  const dsDashboardTopGestoras = useMemo(() => {
    const buckets = new Map<string, { count: number; total: number }>()
    for (const record of dsRecords) {
      const key = record.gestora?.trim()
      if (!key) continue
      const current = buckets.get(key) ?? { count: 0, total: 0 }
      current.count += 1
      const value = record.totalComissaoLojaCmIva ?? record.comissaoLoja ?? record.valor ?? 0
      if (typeof value === 'number') current.total += value
      buckets.set(key, current)
    }

    return [...buckets.entries()]
      .map(([name, bucket]) => ({
        id: name,
        label: name,
        value: bucket.count,
        secondary: formatCurrency(bucket.total),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [dsRecords])

  const dsDashboardTopEntidades = useMemo(() => {
    const buckets = new Map<string, { count: number; total: number }>()
    for (const record of dsRecords) {
      const key = record.entidadeBancaria?.trim()
      if (!key) continue
      const current = buckets.get(key) ?? { count: 0, total: 0 }
      current.count += 1
      const value = record.totalComissaoLojaCmIva ?? record.comissaoLoja ?? record.valor ?? 0
      if (typeof value === 'number') current.total += value
      buckets.set(key, current)
    }

    return [...buckets.entries()]
      .map(([name, bucket]) => ({
        id: name,
        label: name,
        value: bucket.count,
        secondary: formatCurrency(bucket.total),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [dsRecords])

  const dsDashboardByMonth = useMemo(() => {
    const buckets = new Map<string, { ano: number; mes: number; count: number; total: number }>()
    for (const record of dsRecords) {
      if (!record.dataEscritura) continue
      const date = new Date(record.dataEscritura)
      if (Number.isNaN(date.getTime())) continue
      const ano = date.getUTCFullYear()
      const mes = date.getUTCMonth() + 1
      const key = `${ano}-${mes}`
      const current = buckets.get(key) ?? { ano, mes, count: 0, total: 0 }
      current.count += 1
      const value = record.totalComissaoLojaCmIva ?? record.comissaoLoja ?? record.valor ?? 0
      if (typeof value === 'number') current.total += value
      buckets.set(key, current)
    }

    return [...buckets.values()]
      .sort((a, b) => (a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano))
      .slice(-12)
      .map((item) => ({
        id: `${item.ano}-${item.mes}`,
        label: `${MONTHS[item.mes - 1]?.slice(0, 3) ?? item.mes}/${item.ano}`,
        value: item.total,
        secondary: `${new Intl.NumberFormat('pt-PT').format(item.count)} registos`,
      }))
  }, [dsRecords])

  const penhorasDashboardTotals = useMemo(() => {
    let comDataPedido = 0
    let recusados = 0
    let pendentes = 0

    for (const record of penhorasRecords) {
      if (record.dataPedido) comDataPedido += 1
      const status = getStatus(penhorasStatuses, record.estadoId)
      const normalizedStatus = normalizeText(status?.key || status?.label || '')

      if (normalizedStatus.includes('RECUS') || normalizedStatus.includes('DESIST') || normalizedStatus.includes('CANCELAMENTO')) {
        recusados += 1
      } else if (
        (normalizedStatus.includes('AGUARDA') && normalizedStatus.includes('REGIST')) ||
        normalizedStatus.includes('SEM ESTADO') ||
        normalizedStatus.includes('SEM-ESTADO')
      ) {
        pendentes += 1
      }
    }

    return {
      registos: penhorasRecords.length,
      comDataPedido,
      recusados,
      pendentes,
    }
  }, [penhorasRecords, penhorasStatuses])

  const penhorasDashboardByStatus = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const record of penhorasRecords) {
      const key = record.estadoId || 'sem-estado'
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }

    return [...buckets.entries()]
      .map(([statusId, count]) => {
        const status = getStatus(penhorasStatuses, statusId)
        return {
          id: statusId,
          label: status?.label ?? 'Sem estado',
          value: count,
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [penhorasRecords, penhorasStatuses])

  const penhorasDashboardTopGestores = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const record of penhorasRecords) {
      const key = record.gestor?.trim()
      if (!key) continue
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }

    return [...buckets.entries()]
      .map(([gestor, count]) => ({
        id: gestor,
        label: gestor,
        value: count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [penhorasRecords])

  const penhorasDashboardByMonth = useMemo(() => {
    const buckets = new Map<string, { ano: number; mes: number; count: number }>()
    for (const record of penhorasRecords) {
      if (!record.dataPedido) continue
      const date = new Date(record.dataPedido)
      if (Number.isNaN(date.getTime())) continue
      const ano = date.getUTCFullYear()
      const mes = date.getUTCMonth() + 1
      const key = `${ano}-${mes}`
      const current = buckets.get(key) ?? { ano, mes, count: 0 }
      current.count += 1
      buckets.set(key, current)
    }

    return [...buckets.values()]
      .sort((a, b) => (a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano))
      .slice(-12)
      .map((item) => ({
        id: `${item.ano}-${item.mes}`,
        label: `${MONTHS[item.mes - 1]?.slice(0, 3) ?? item.mes}/${item.ano}`,
        value: item.count,
      }))
  }, [penhorasRecords])

  return {
    dsDashboardTotals,
    dsDashboardByStatus,
    dsDashboardTopGestoras,
    dsDashboardTopEntidades,
    dsDashboardByMonth,
    penhorasDashboardTotals,
    penhorasDashboardByStatus,
    penhorasDashboardTopGestores,
    penhorasDashboardByMonth,
  }
}

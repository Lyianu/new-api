/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import { getLobeIcon } from '@/lib/lobe-icon'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import { ModelCard } from './model-card'
import type { ModelPerfBadgeData } from './model-perf-badge'

export interface ModelCardGroupedProps {
  models: PricingModel[]
  onModelClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
}

interface VendorGroup {
  key: string
  name: string
  icon?: string
  models: PricingModel[]
}

// groupByVendor 按供应商(vendor)对模型分组；无供应商的归入末尾的“其他”组。
function groupByVendor(
  models: PricingModel[],
  otherLabel: string
): VendorGroup[] {
  const groups = new Map<string, VendorGroup>()
  for (const model of models) {
    const name = model.vendor_name?.trim() || otherLabel
    const key = model.vendor_name?.trim()
      ? `v:${model.vendor_id ?? name}`
      : '__other__'
    let group = groups.get(key)
    if (!group) {
      group = { key, name, icon: model.vendor_icon, models: [] }
      groups.set(key, group)
    }
    if (!group.icon && model.vendor_icon) group.icon = model.vendor_icon
    group.models.push(model)
  }

  const list = Array.from(groups.values())
  // 排序：真实供应商按模型数量降序、同数量按名称升序；“其他”组恒置末尾。
  list.sort((a, b) => {
    const aOther = a.key === '__other__'
    const bOther = b.key === '__other__'
    if (aOther !== bOther) return aOther ? 1 : -1
    if (b.models.length !== a.models.length) {
      return b.models.length - a.models.length
    }
    return a.name.localeCompare(b.name)
  })
  return list
}

export function ModelCardGrouped(props: ModelCardGroupedProps) {
  const { t } = useTranslation()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT

  const perfQuery = useQuery({
    queryKey: ['perf-metrics-summary', 24],
    queryFn: () => getPerfMetricsSummary(24),
    staleTime: 60 * 1000,
    retry: false,
  })

  const perfMap = useMemo(() => {
    const map = new Map<string, ModelPerfBadgeData>()
    for (const model of perfQuery.data?.data?.models ?? []) {
      map.set(model.model_name, model)
    }
    return map
  }, [perfQuery.data])

  const groups = useMemo(
    () => groupByVendor(props.models, t('Other')),
    [props.models, t]
  )

  if (props.models.length === 0) {
    return null
  }

  return (
    <div className='space-y-8'>
      {groups.map((group) => (
        <section key={group.key} className='space-y-3 sm:space-y-4'>
          <div className='flex items-center gap-2.5 border-b pb-2.5'>
            {group.icon ? (
              <span className='flex size-6 shrink-0 items-center justify-center'>
                {getLobeIcon(group.icon, 22)}
              </span>
            ) : null}
            <h2 className='text-base font-semibold tracking-tight sm:text-lg'>
              {group.name}
            </h2>
            <span className='text-muted-foreground bg-muted rounded-full px-2 py-0.5 text-xs font-medium'>
              {t('{{count}} models', { count: group.models.length })}
            </span>
          </div>
          <div className='grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {group.models.map((model) => (
              <ModelCard
                key={model.id ?? model.model_name}
                model={model}
                tokenUnit={tokenUnit}
                priceRate={props.priceRate}
                usdExchangeRate={props.usdExchangeRate}
                showRechargePrice={props.showRechargePrice}
                selectedGroup={props.selectedGroup}
                perf={perfMap.get(model.model_name || '')}
                onClick={() => props.onModelClick(model.model_name || '')}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

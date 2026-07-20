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
import { useState, useCallback, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'
import { ModelsChartPreferences } from '@/features/dashboard/components/models/models-chart-preferences'
import { ModelsFilter } from '@/features/dashboard/components/models/models-filter-dialog'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import {
  buildDefaultDashboardFilters,
  getSavedChartPreferences,
  saveChartPreferences,
} from '@/features/dashboard/lib'
import type {
  DashboardChartPreferences,
  DashboardFilters,
  QuotaDataItem,
} from '@/features/dashboard/types'

import { BalanceCards } from './components/balance-cards'

const LazyLogStatCards = lazy(() =>
  import('@/features/dashboard/components/models/log-stat-cards').then((m) => ({
    default: m.LogStatCards,
  }))
)

const LazyModelCharts = lazy(() =>
  import('@/features/dashboard/components/models/model-charts').then((m) => ({
    default: m.ModelCharts,
  }))
)

const LazyConsumptionDistributionChart = lazy(() =>
  import(
    '@/features/dashboard/components/models/consumption-distribution-chart'
  ).then((m) => ({
    default: m.ConsumptionDistributionChart,
  }))
)

function StatCardsFallback() {
  return <Skeleton className='h-24 w-full rounded-lg' />
}

function ChartFallback() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex items-center justify-between border-b px-4 py-3 sm:px-5'>
        <Skeleton className='h-5 w-32' />
        <Skeleton className='h-8 w-72' />
      </div>
      <div className='h-96 p-2'>
        <Skeleton className='h-full w-full' />
      </div>
    </div>
  )
}

/**
 * 用量信息页（普通用户控制台首页）。
 *
 * DeepSeek 式版式：余额 / 累计消费大卡 → 筛选 → 统计卡 → 消费图表。
 * 统计与图表复用 dashboard 的 models section 组件。
 */
export function UsageInfo() {
  const { t } = useTranslation()
  const [modelData, setModelData] = useState<QuotaDataItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [chartPreferences, setChartPreferences] =
    useState<DashboardChartPreferences>(() => getSavedChartPreferences())
  const [filters, setFilters] = useState<DashboardFilters>(() =>
    buildDefaultDashboardFilters(getSavedChartPreferences())
  )

  const handleFilterChange = useCallback((next: DashboardFilters) => {
    setFilters(next)
  }, [])

  const handleResetFilters = useCallback(() => {
    setFilters(buildDefaultDashboardFilters(chartPreferences))
  }, [chartPreferences])

  const handleDataUpdate = useCallback(
    (data: QuotaDataItem[], loading: boolean) => {
      setModelData(data)
      setDataLoading(loading)
    },
    []
  )

  const handleChartPreferencesChange = useCallback(
    (preferences: DashboardChartPreferences) => {
      setChartPreferences(preferences)
      setFilters(buildDefaultDashboardFilters(preferences))
      saveChartPreferences(preferences)
    },
    []
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Usage Info')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Your balance, credits and recent consumption at a glance.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='space-y-3 sm:space-y-4'>
          <FadeIn>
            <BalanceCards />
          </FadeIn>
          <div className='flex flex-wrap items-center justify-end gap-1.5 sm:gap-2'>
            <ModelsChartPreferences
              preferences={chartPreferences}
              onPreferencesChange={handleChartPreferencesChange}
            />
            <ModelsFilter
              preferences={chartPreferences}
              currentFilters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
            />
          </div>
          <FadeIn delay={0.05}>
            <Suspense fallback={<StatCardsFallback />}>
              <LazyLogStatCards
                filters={filters}
                onDataUpdate={handleDataUpdate}
              />
            </Suspense>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Suspense fallback={<ChartFallback />}>
              <LazyConsumptionDistributionChart
                data={modelData}
                loading={dataLoading}
                defaultChartType={chartPreferences.consumptionDistributionChart}
                timeGranularity={
                  filters.time_granularity || DEFAULT_TIME_GRANULARITY
                }
              />
            </Suspense>
          </FadeIn>
          <FadeIn delay={0.15}>
            <Suspense fallback={<ChartFallback />}>
              <LazyModelCharts
                data={modelData}
                loading={dataLoading}
                defaultChartTab={chartPreferences.modelAnalyticsChart}
                timeGranularity={
                  filters.time_granularity || DEFAULT_TIME_GRANULARITY
                }
              />
            </Suspense>
          </FadeIn>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

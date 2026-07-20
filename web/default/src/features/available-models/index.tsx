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
import { Check, Copy, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { usePricingData } from '@/features/pricing/hooks'
import {
  formatFixedPrice,
  formatGroupPrice,
  isTokenBasedModel,
} from '@/features/pricing/lib'
import type { PricingModel } from '@/features/pricing/types'

/**
 * 可用模型页（普通用户控制台）。
 *
 * 展示当前账号的可用分组与各分组下可调用的模型及价格。
 * 分组数量通常很少，因此采用简洁的「分组卡片 + 模型表格」布局，
 * 而非模型广场的多维筛选版式。
 */
export function AvailableModels() {
  const { t } = useTranslation()
  const {
    models,
    usableGroup,
    groupRatio,
    autoGroups,
    isLoading,
  } = usePricingData()

  const groups = useMemo(
    () =>
      Object.entries(usableGroup)
        .filter(([name]) => name !== '')
        .map(([name, desc]) => ({
          name,
          desc: typeof desc === 'string' ? desc : (desc?.desc ?? ''),
          ratio: groupRatio[name],
          isAuto: autoGroups.includes(name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [usableGroup, groupRatio, autoGroups]
  )

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')

  const activeGroup =
    selectedGroup && groups.some((g) => g.name === selectedGroup)
      ? selectedGroup
      : (groups[0]?.name ?? null)

  const visibleModels = useMemo(() => {
    if (!activeGroup) return []
    const lowered = keyword.trim().toLowerCase()
    return models
      .filter((model) => {
        const enableGroups = model.enable_groups || []
        return (
          enableGroups.includes(activeGroup) || enableGroups.includes('all')
        )
      })
      .filter(
        (model) =>
          lowered === '' || model.model_name.toLowerCase().includes(lowered)
      )
      .sort((a, b) => a.model_name.localeCompare(b.model_name))
  }, [models, activeGroup, keyword])

  // 缓存价格列仅在当前分组下有模型配置了对应倍率时才展示，保持表格简洁
  const showCacheRead = visibleModels.some((m) => m.cache_ratio != null)
  const showCacheWrite = visibleModels.some((m) => m.create_cache_ratio != null)
  const columnCount = 3 + (showCacheRead ? 1 : 0) + (showCacheWrite ? 1 : 0)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Available Models')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Models available to your account and their pricing.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-5xl space-y-5'>
          <p className='text-muted-foreground text-sm'>
            {t('Groups and models available to your account')}
          </p>

          {/* 可用分组 */}
          <section className='space-y-2'>
            <h3 className='text-sm font-medium'>{t('Available Groups')}</h3>
            {isLoading && (
              <div className='flex flex-wrap gap-2'>
                <Skeleton className='h-16 w-44 rounded-lg' />
                <Skeleton className='h-16 w-44 rounded-lg' />
              </div>
            )}
            {!isLoading && groups.length === 0 && (
              <p className='text-muted-foreground text-sm'>
                {t('No available groups')}
              </p>
            )}
            {!isLoading && groups.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {groups.map((group) => (
                  <button
                    key={group.name}
                    type='button'
                    onClick={() => setSelectedGroup(group.name)}
                    className={cn(
                      'min-w-40 rounded-lg border px-3 py-2 text-left transition-colors',
                      group.name === activeGroup
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/40'
                    )}
                  >
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-medium'>{group.name}</span>
                      {group.isAuto && (
                        <span className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]'>
                          {t('Auto')}
                        </span>
                      )}
                    </div>
                    <div className='text-muted-foreground mt-0.5 text-xs'>
                      {group.desc || t('Group Ratio')}
                      {typeof group.ratio === 'number' && (
                        <span className='ml-1 font-mono'>
                          ×{group.ratio}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 模型列表 */}
          <section className='space-y-2'>
            <div className='flex items-center justify-between gap-2'>
              <h3 className='text-sm font-medium'>{t('Model')}</h3>
              <div className='relative w-56'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  placeholder={t('Search models...')}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className='h-8 pl-9'
                />
              </div>
            </div>

            {isLoading && (
              <div className='space-y-2'>
                {['a', 'b', 'c', 'd', 'e'].map((key) => (
                  <Skeleton key={key} className='h-10 w-full rounded-md' />
                ))}
              </div>
            )}
            {!isLoading && (
              <div className='overflow-hidden rounded-lg border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Model')}</TableHead>
                      <TableHead className='text-right'>
                        {t('Input')}{' '}
                        <span className='text-muted-foreground font-normal'>
                          / 1M
                        </span>
                      </TableHead>
                      <TableHead className='text-right'>
                        {t('Output')}{' '}
                        <span className='text-muted-foreground font-normal'>
                          / 1M
                        </span>
                      </TableHead>
                      {showCacheRead && (
                        <TableHead className='text-right'>
                          {t('Cache Read')}{' '}
                          <span className='text-muted-foreground font-normal'>
                            / 1M
                          </span>
                        </TableHead>
                      )}
                      {showCacheWrite && (
                        <TableHead className='text-right'>
                          {t('Cache Write')}{' '}
                          <span className='text-muted-foreground font-normal'>
                            / 1M
                          </span>
                        </TableHead>
                      )}
                      <TableHead className='text-right'>
                        {t('Multiplier')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleModels.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={columnCount + 1}
                          className='text-muted-foreground h-24 text-center text-sm'
                        >
                          {t('No models available')}
                        </TableCell>
                      </TableRow>
                    )}
                    {visibleModels.map((model) => (
                      <ModelRow
                        key={model.model_name}
                        model={model}
                        group={activeGroup ?? ''}
                        groupRatio={groupRatio}
                        showCacheRead={showCacheRead}
                        showCacheWrite={showCacheWrite}
                        priceColumnCount={columnCount - 1}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

/**
 * 「元/刀」倍率：我方 CNY 价 ÷ 官方 USD 锚价。
 * 官方 10/50 USD/M、我方 15/75 CNY/M → 1.5。以输入价为基准计算，
 * 分组倍率计入我方价格。无官方锚（自定义模型）时返回 null。
 */
function cnyPerUsdRate(
  model: PricingModel,
  group: string,
  groupRatio: Record<string, number>
): number | null {
  const ratio = groupRatio[group]
  const effectiveGroupRatio =
    typeof ratio === 'number' && Number.isFinite(ratio) ? ratio : 1
  if (isTokenBasedModel(model)) {
    if (!model.official_usd_ratio || model.official_usd_ratio <= 0) return null
    return (model.model_ratio * effectiveGroupRatio) / model.official_usd_ratio
  }
  if (!model.official_usd_price || model.official_usd_price <= 0) return null
  return ((model.model_price || 0) * effectiveGroupRatio) / model.official_usd_price
}

function formatRate(rate: number): string {
  return Number(rate.toFixed(2)).toString()
}

function ModelRow(props: {
  model: PricingModel
  group: string
  groupRatio: Record<string, number>
  showCacheRead: boolean
  showCacheWrite: boolean
  priceColumnCount: number
}) {
  const { t } = useTranslation()
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })
  const { model, group, groupRatio, showCacheRead, showCacheWrite } = props

  const iconKey = model.icon || model.vendor_icon
  const icon = iconKey ? getLobeIcon(iconKey, 18) : null
  const isDynamic =
    model.billing_mode === 'tiered_expr' && Boolean(model.billing_expr)
  const isTokenBased = isTokenBasedModel(model)
  const rate = isDynamic ? null : cnyPerUsdRate(model, group, groupRatio)

  let priceCells: React.ReactNode
  if (isDynamic) {
    priceCells = (
      <TableCell
        colSpan={props.priceColumnCount}
        className='text-muted-foreground text-right text-sm'
      >
        {t('Dynamic Pricing')}
      </TableCell>
    )
  } else if (isTokenBased) {
    priceCells = (
      <>
        <TableCell className='text-right font-mono text-sm'>
          {formatGroupPrice(model, group, 'input', 'M', false, 1, 1, groupRatio)}
        </TableCell>
        <TableCell className='text-right font-mono text-sm'>
          {formatGroupPrice(model, group, 'output', 'M', false, 1, 1, groupRatio)}
        </TableCell>
        {showCacheRead && (
          <TableCell className='text-muted-foreground text-right font-mono text-sm'>
            {model.cache_ratio != null
              ? formatGroupPrice(model, group, 'cache', 'M', false, 1, 1, groupRatio)
              : '—'}
          </TableCell>
        )}
        {showCacheWrite && (
          <TableCell className='text-muted-foreground text-right font-mono text-sm'>
            {model.create_cache_ratio != null
              ? formatGroupPrice(model, group, 'create_cache', 'M', false, 1, 1, groupRatio)
              : '—'}
          </TableCell>
        )}
      </>
    )
  } else {
    priceCells = (
      <TableCell
        colSpan={props.priceColumnCount}
        className='text-right font-mono text-sm'
      >
        {formatFixedPrice(model, group, false, 1, 1, groupRatio)}{' '}
        <span className='text-muted-foreground font-sans'>
          / {t('request')}
        </span>
      </TableCell>
    )
  }

  return (
    <TableRow>
      <TableCell>
        <div className='flex min-w-0 items-center gap-2'>
          {icon && <span className='shrink-0'>{icon}</span>}
          <code className='truncate font-mono text-sm'>{model.model_name}</code>
          <button
            type='button'
            onClick={() => copyToClipboard(model.model_name)}
            className='text-muted-foreground hover:text-foreground shrink-0'
            aria-label={t('Copy')}
          >
            {copiedText === model.model_name ? (
              <Check className='h-3.5 w-3.5' />
            ) : (
              <Copy className='h-3.5 w-3.5' />
            )}
          </button>
        </div>
      </TableCell>
      {priceCells}
      <TableCell className='text-right text-sm'>
        {rate != null ? (
          <span className='font-mono'>
            {formatRate(rate)}{' '}
            <span className='text-muted-foreground'>{t('CNY/USD')}</span>
          </span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        )}
      </TableCell>
    </TableRow>
  )
}

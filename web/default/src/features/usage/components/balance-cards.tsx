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
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getSelf } from '@/lib/api'
import { formatQuotaWithCurrency } from '@/lib/currency'

interface SelfData {
  quota?: number
  used_quota?: number
}

/**
 * 用量信息页顶部大卡：余额（含「去充值」）+ 累计消费金额。
 */
export function BalanceCards() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [self, setSelf] = useState<SelfData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await getSelf()
        if (!cancelled && response.success && response.data) {
          setSelf(response.data as SelfData)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const amountOptions = { abbreviate: false, compact: false } as const

  return (
    <div className='grid gap-3 sm:grid-cols-2 sm:gap-4'>
      <Card
        data-card-hover='false'
        className='flex-row items-center justify-between gap-3 px-4 py-4 sm:px-5'
      >
        <div className='min-w-0'>
          <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            {t('Current Balance')}
          </div>
          {loading ? (
            <Skeleton className='mt-2 h-8 w-28' />
          ) : (
            <div className='mt-1 font-mono text-2xl font-bold tracking-tight tabular-nums sm:text-3xl'>
              {formatQuotaWithCurrency(self?.quota ?? 0, amountOptions)}
            </div>
          )}
        </div>
        <Button
          className='shrink-0'
          onClick={() => void navigate({ to: '/wallet' })}
        >
          {t('Top-up')}
        </Button>
      </Card>

      <Card
        data-card-hover='false'
        className='flex-row items-center justify-between gap-3 px-4 py-4 sm:px-5'
      >
        <div className='min-w-0'>
          <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            {t('Cumulative Consumption')}
          </div>
          {loading ? (
            <Skeleton className='mt-2 h-8 w-28' />
          ) : (
            <div className='mt-1 font-mono text-2xl font-bold tracking-tight tabular-nums sm:text-3xl'>
              {formatQuotaWithCurrency(self?.used_quota ?? 0, amountOptions)}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

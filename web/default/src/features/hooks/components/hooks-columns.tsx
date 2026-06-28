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
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { type Hook } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export function useHooksColumns(): ColumnDef<Hook>[] {
  const { t } = useTranslation()
  return [
    {
      accessorKey: 'id',
      header: t('ID'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <TableId value={row.getValue('id') as number} className='w-[60px]' />
      ),
      size: 80,
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-medium'>{row.getValue('name')}</span>
      ),
      size: 180,
    },
    {
      accessorKey: 'type',
      header: t('Type'),
      meta: { mobileBadge: true },
      cell: ({ row }) => (
        <StatusBadge
          label={row.getValue('type') as string}
          variant='info'
          copyable={false}
          className='-ml-1.5'
        />
      ),
      size: 120,
    },
    {
      accessorKey: 'enabled',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const enabled = row.getValue('enabled') as boolean
        return (
          <StatusBadge
            label={enabled ? t('Enabled') : t('Disabled')}
            variant={enabled ? 'success' : 'neutral'}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 110,
    },
    {
      id: 'events',
      accessorKey: 'events',
      header: t('Events'),
      enableSorting: false,
      cell: ({ row }) => {
        const events = (row.getValue('events') as string[]) ?? []
        if (events.length === 0) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }
        return (
          <div className='flex flex-wrap gap-1'>
            {events.map((event) => (
              <StatusBadge
                key={event}
                label={event}
                variant='neutral'
                copyable={false}
              />
            ))}
          </div>
        )
      },
      size: 240,
    },
    {
      accessorKey: 'mode',
      header: t('Mode'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const mode = row.getValue('mode') as string
        return (
          <StatusBadge
            label={mode === 'async' ? t('Async') : t('Sync')}
            variant='neutral'
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 110,
    },
    {
      accessorKey: 'fail_mode',
      header: t('Fail Mode'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const failMode = row.getValue('fail_mode') as string
        return (
          <StatusBadge
            label={failMode === 'open' ? t('Fail open') : t('Fail closed')}
            variant={failMode === 'open' ? 'warning' : 'neutral'}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 130,
    },
    {
      accessorKey: 'priority',
      header: t('Priority'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <span className='font-mono text-sm'>{row.getValue('priority')}</span>
      ),
      size: 90,
    },
    {
      accessorKey: 'updated_at',
      header: t('Updated'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <div className='min-w-[160px] font-mono text-sm'>
          {formatTimestampToDate(row.getValue('updated_at'))}
        </div>
      ),
      size: 180,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <DataTableRowActions row={row} />,
      meta: { pinned: 'right' as const },
    },
  ]
}

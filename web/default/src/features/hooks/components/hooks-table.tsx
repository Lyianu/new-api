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
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { DataTablePage, useDataTable } from '@/components/data-table'
import { getHooks } from '../api'
import { useHooksColumns } from './hooks-columns'
import { useHooks } from './hooks-provider'

const route = getRouteApi('/_authenticated/hooks/')

export function HooksTable() {
  const { t } = useTranslation()
  const columns = useHooksColumns()
  const { refreshTrigger } = useHooks()
  const isMobile = useMediaQuery('(max-width: 640px)')

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
  })

  // 后端返回全量数组，分页 / 过滤全部在客户端完成（管理配置量小）。
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['hooks', refreshTrigger],
    queryFn: async () => {
      const result = await getHooks()
      return result.data ?? []
    },
    placeholderData: (previousData) => previousData,
  })

  const hooks = data ?? []

  const { table } = useDataTable({
    data: hooks,
    columns,
    enableRowSelection: false,
    columnFilters,
    globalFilter,
    pagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const name = String(row.getValue('name')).toLowerCase()
      const type = String(row.getValue('type')).toLowerCase()
      const id = String(row.getValue('id'))
      const searchValue = String(filterValue).toLowerCase()
      return (
        name.includes(searchValue) ||
        type.includes(searchValue) ||
        id.includes(searchValue)
      )
    },
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: false,
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Hooks Found')}
      emptyDescription={t(
        'No hooks configured. Create your first hook to get started.'
      )}
      skeletonKeyPrefix='hooks-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by name, type or ID...'),
      }}
    />
  )
}

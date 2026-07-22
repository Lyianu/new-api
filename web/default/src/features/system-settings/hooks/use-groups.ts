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

import { api } from '@/lib/api'

/**
 * 系统内全部可用分组名（/api/group/）。
 * 供设置页中需要按分组配置的编辑器做选单，避免手输分组名出错。
 */
export function useGroups() {
  const { data, isLoading } = useQuery({
    queryKey: ['system-settings', 'groups'],
    queryFn: async () => {
      const res = await api.get('/api/group/')
      return (res.data?.data ?? []) as string[]
    },
    staleTime: 60_000,
  })
  return { groups: data ?? [], loading: isLoading }
}

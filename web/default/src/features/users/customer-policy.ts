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
import { api } from '@/lib/api'

// 客户策略（按 vendor/渠道×模型 粒度的折扣与并发/RPM）。
export interface CustomerPolicy {
  id: number
  user_id: number
  vendor_id: number
  channel_id: number
  model_name: string
  discount_ratio: number
  max_concurrency: number
  rpm_limit: number
  priority: number
}

export interface PolicyApiResponse {
  success: boolean
  message: string
  data?: unknown
}

export async function getCustomerPolicies(
  userId: number
): Promise<CustomerPolicy[]> {
  const res = await api.get(`/api/customer-policy/?user_id=${userId}`)
  return (res.data?.data as CustomerPolicy[]) ?? []
}

export async function addCustomerPolicy(
  payload: Omit<CustomerPolicy, 'id'>
): Promise<PolicyApiResponse> {
  const res = await api.post('/api/customer-policy/', payload)
  return res.data
}

export async function updateCustomerPolicy(
  payload: CustomerPolicy
): Promise<PolicyApiResponse> {
  const res = await api.put('/api/customer-policy/', payload)
  return res.data
}

export async function deleteCustomerPolicy(
  id: number
): Promise<PolicyApiResponse> {
  const res = await api.delete(`/api/customer-policy/${id}`)
  return res.data
}

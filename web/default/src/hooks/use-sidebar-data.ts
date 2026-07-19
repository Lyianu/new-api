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
import {
  Activity,
  BookOpen,
  Box,
  Boxes,
  CreditCard,
  FileText,
  FlaskConical,
  Key,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Radio,
  Receipt,
  ServerCog,
  Settings,
  Tag,
  Ticket,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SidebarData } from '@/components/layout/types'
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'

/**
 * Root navigation groups for the application sidebar.
 *
 * 普通用户仅可见「控制台」六项（用量信息 / API Keys / 可用模型 / 充值 / 账单 / 日志明细）
 * 与「资源」次要组（接口文档 / 模型定价 / 个人信息），版式对齐 DeepSeek 开放平台。
 * Playground / Chat / 仪表盘分析 / 任务日志保留为管理员专属，管理端体验不变。
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsLink =
    typeof status?.docs_link === 'string' ? status.docs_link.trim() : ''

  return {
    navGroups: [
      {
        id: 'console',
        title: t('Console'),
        items: [
          {
            title: t('Usage Info'),
            url: '/usage',
            icon: Activity,
          },
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Available Models'),
            url: '/available-models',
            icon: Boxes,
          },
          {
            title: t('Top-up'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Bills'),
            url: '/billing',
            icon: Receipt,
          },
          {
            title: t('Usage Logs'),
            url: '/usage-logs/common',
            icon: FileText,
          },
        ],
      },
      {
        id: 'resources',
        title: t('Resources'),
        items: [
          ...(docsLink
            ? [
                {
                  title: t('API Docs'),
                  url: docsLink,
                  icon: BookOpen,
                },
              ]
            : []),
          {
            title: t('Model Pricing'),
            url: '/pricing',
            icon: Tag,
          },
          {
            title: t('Profile'),
            url: '/profile',
            icon: User,
          },
        ],
      },
      {
        id: 'advanced',
        title: t('Analytics'),
        items: [
          {
            title: t('Playground'),
            url: '/playground',
            icon: FlaskConical,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Chat'),
            icon: MessageSquare,
            type: 'chat-presets',
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Dashboard'),
            url: '/dashboard/models',
            icon: LayoutDashboard,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Task Logs'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/drawing', '/usage-logs/task'],
            icon: ListTodo,
            requiredRole: ROLE.ADMIN,
          },
        ],
      },
      {
        id: 'admin',
        title: t('Admin'),
        items: [
          {
            title: t('Channels'),
            url: '/channels',
            icon: Radio,
          },
          {
            title: t('Models'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Redemption Codes'),
            url: '/redemption-codes',
            icon: Ticket,
          },
          {
            title: t('Subscriptions'),
            url: '/subscriptions',
            icon: CreditCard,
          },
          {
            title: t('System Info'),
            url: '/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
          },
        ],
      },
    ],
  }
}

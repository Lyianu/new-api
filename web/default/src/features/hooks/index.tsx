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
// FORK: 自定义钩子（Custom Hooks）管理页入口。
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { HooksDialogs } from './components/hooks-dialogs'
import { HooksPrimaryButtons } from './components/hooks-primary-buttons'
import { HooksProvider } from './components/hooks-provider'
import { HooksTable } from './components/hooks-table'

export function Hooks() {
  const { t } = useTranslation()
  return (
    <HooksProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Hooks')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <HooksPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <HooksTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <HooksDialogs />
    </HooksProvider>
  )
}

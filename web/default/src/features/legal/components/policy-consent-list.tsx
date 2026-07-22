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
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { PolicyViewerDialog } from './policy-viewer-dialog'
import type { PolicyVersion } from '../policy'

// 逐项确认列表：每一份已发布的合规文档一行，各自独立勾选。
// 点击标题打开只读全文弹窗，避免离开注册流程。

interface PolicyConsentListProps {
  policies: PolicyVersion[]
  accepted: Record<string, boolean>
  onToggle: (docType: string, value: boolean) => void
  className?: string
}

export function PolicyConsentList({
  policies,
  accepted,
  onToggle,
  className,
}: PolicyConsentListProps) {
  const { t } = useTranslation()

  if (policies.length === 0) return null

  return (
    <div
      className={cn(
        'border-border/60 divide-border/60 divide-y rounded-lg border',
        className
      )}
    >
      {policies.map((p) => (
        <div key={p.doc_type} className='flex items-start gap-3 px-3.5 py-3'>
          <Checkbox
            id={`policy-${p.doc_type}`}
            checked={Boolean(accepted[p.doc_type])}
            onCheckedChange={(v) => onToggle(p.doc_type, v === true)}
            className='mt-0.5'
          />
          <Label
            htmlFor={`policy-${p.doc_type}`}
            className='text-muted-foreground gap-1 text-left text-[13px] leading-5 font-normal'
          >
            <span>
              {t('I have read and agree to the')}{' '}
              <PolicyViewerDialog
                title={p.title}
                content={p.content}
                trigger={
                  <button
                    type='button'
                    className='text-primary underline-offset-2 hover:underline'
                  >
                    {p.title}
                  </button>
                }
              />
            </span>
          </Label>
        </div>
      ))}
    </div>
  )
}

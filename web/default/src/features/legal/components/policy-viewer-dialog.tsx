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
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { RichContent } from '@/components/rich-content'
import { isLikelyHtml } from '@/lib/content-format'

// 合规文档只读全文弹窗。文档内容可能是 HTML 或 Markdown，按内容判定渲染。

interface PolicyViewerDialogProps {
  title: string
  content: string
  trigger: ReactElement
}

export function PolicyViewerDialog({
  title,
  content,
  trigger,
}: PolicyViewerDialogProps) {
  const { t } = useTranslation()
  const isHtml = isLikelyHtml(content)

  return (
    <Dialog
      trigger={trigger}
      title={title}
      description={t('Please read the full document below.')}
      contentClassName='max-w-2xl'
      contentHeight='auto'
      bodyClassName='max-h-[60vh] overflow-auto'
    >
      <RichContent
        mode={isHtml ? 'html' : 'markdown'}
        content={content}
        className='text-sm leading-relaxed'
      />
    </Dialog>
  )
}

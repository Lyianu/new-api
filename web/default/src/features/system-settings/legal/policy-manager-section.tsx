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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  getPolicyVersionHistory,
  publishPolicy,
  POLICY_TYPES,
  type PolicyType,
} from '@/features/legal/policy'

import { SettingsSection } from '../components/settings-section'

// 合规文档管理：选择文档类型 → 编辑标题/正文 → 发布新版本。
// 发布即令已确认旧版的用户在下次登录时重新确认；勾选"暂停服务"后，
// 未确认用户的 API 调用被阻断（网页控制台不受影响）。

const DOC_TYPE_LABELS: Record<PolicyType, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  refund_policy: 'Refund Policy',
}

export function PolicyManagerSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [docType, setDocType] = useState<PolicyType>('terms_of_service')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [blockUntilAccept, setBlockUntilAccept] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['policy-versions', docType],
    queryFn: () => getPolicyVersionHistory(docType),
  })

  // 切换文档类型时，用最新版本预填标题/正文，便于在其基础上改
  useEffect(() => {
    const latest = versions[0]
    setTitle(latest?.title ?? '')
    setContent(latest?.content ?? '')
    setBlockUntilAccept(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType, versions.length])

  const handlePublish = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error(t('Title and content are required'))
      return
    }
    setPublishing(true)
    try {
      const res = await publishPolicy({
        doc_type: docType,
        title: title.trim(),
        content,
        block_until_accept: blockUntilAccept,
      })
      if (res.success) {
        toast.success(t('New version published'))
        await queryClient.invalidateQueries({
          queryKey: ['policy-versions', docType],
        })
        await queryClient.invalidateQueries({ queryKey: ['policy-latest'] })
        await queryClient.invalidateQueries({ queryKey: ['policy-status'] })
      } else {
        toast.error(res.message || t('Failed to publish'))
      }
    } catch {
      toast.error(t('Failed to publish'))
    } finally {
      setPublishing(false)
    }
  }

  const latestVersion = versions[0]
  let versionHint = t('No version published yet')
  if (isLoading) {
    versionHint = t('Loading...')
  } else if (latestVersion) {
    versionHint = t('Current version: v{{n}}', { n: latestVersion.version })
  }

  return (
    <SettingsSection title={t('Legal documents')}>
      <div className='space-y-5'>
        <div className='grid gap-2'>
          <Label>{t('Document type')}</Label>
          <Select
            value={docType}
            onValueChange={(v) => setDocType(v as PolicyType)}
          >
            <SelectTrigger className='w-full sm:w-72'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POLICY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(DOC_TYPE_LABELS[type])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-xs'>{versionHint}</p>
        </div>

        <div className='grid gap-2'>
          <Label>{t('Title')}</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(DOC_TYPE_LABELS[docType])}
          />
        </div>

        <div className='grid gap-2'>
          <Label>{t('Content (Markdown or HTML)')}</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            className='font-mono text-sm'
            placeholder={t('Paste or write the full document here...')}
          />
        </div>

        <div className='border-border/60 bg-muted/30 flex items-start gap-3 rounded-md border p-3'>
          <Checkbox
            id='block-until-accept'
            checked={blockUntilAccept}
            onCheckedChange={(v) => setBlockUntilAccept(v === true)}
            className='mt-0.5'
          />
          <Label
            htmlFor='block-until-accept'
            className='gap-1 text-left text-[13px] leading-5 font-normal'
          >
            <span className='text-foreground font-medium'>
              {t('Pause API service until re-accepted')}
            </span>
            <span className='text-muted-foreground'>
              {t(
                'Users who accepted an older version will have their API calls blocked until they accept this version. The web console stays accessible so they can accept.'
              )}
            </span>
          </Label>
        </div>

        <div className='flex items-center justify-between'>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Publishing creates a new immutable version. Existing users re-confirm on next login.'
            )}
          </p>
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing ? t('Publishing...') : t('Publish new version')}
          </Button>
        </div>

        {versions.length > 0 && (
          <div className='border-border/60 divide-border/60 divide-y rounded-md border text-sm'>
            <div className='text-muted-foreground grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 py-2 text-xs font-medium'>
              <span>{t('Version')}</span>
              <span>{t('Title')}</span>
              <span>{t('Blocking')}</span>
              <span>{t('Published')}</span>
            </div>
            {versions.map((v) => (
              <div
                key={v.id}
                className='grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-3 py-2'
              >
                <span className='font-mono'>v{v.version}</span>
                <span className='truncate'>{v.title}</span>
                <span>
                  {v.block_until_accept ? (
                    <span className='text-warning-foreground'>{t('Yes')}</span>
                  ) : (
                    <span className='text-muted-foreground'>{t('No')}</span>
                  )}
                </span>
                <span className='text-muted-foreground text-xs'>
                  {new Date(v.created_at * 1000).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsSection>
  )
}

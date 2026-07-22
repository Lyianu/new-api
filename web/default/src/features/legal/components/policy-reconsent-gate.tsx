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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth-store'

import { PolicyViewerDialog } from './policy-viewer-dialog'
import {
  acceptPolicies,
  getLatestPolicies,
  getPolicyStatus,
  type PolicyType,
} from '../policy'

// 登录后守卫：若已确认过的协议出现新版本，强制弹窗重新逐项确认。
// 弹窗不可关闭；若任一待确认文档标记了"暂停服务"，在确认前用户的
// API 调用已被后端阻断（见 middleware/auth.go）。

export function PolicyReconsentGate() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user

  const { data: status } = useQuery({
    queryKey: ['policy-status'],
    queryFn: getPolicyStatus,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const { data: latest } = useQuery({
    queryKey: ['policy-latest'],
    queryFn: getLatestPolicies,
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const pending = (status ?? []).filter((s) => s.needs_accept)
  const pendingKey = pending
    .map((p) => `${p.doc_type}:${p.latest_version}`)
    .join(',')
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setChecked({})
  }, [pendingKey])

  const mutation = useMutation({
    mutationFn: (docTypes: PolicyType[]) => acceptPolicies(docTypes),
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to submit'))
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['policy-status'] })
      toast.success(t('Thanks — you are all set'))
    },
    onError: () => toast.error(t('Failed to submit')),
  })

  if (!isAuthenticated || pending.length === 0) return null

  const allChecked = pending.every((p) => checked[p.doc_type])
  const hasBlocking = pending.some((p) => p.block)

  const contentByType = new Map(
    (latest ?? []).map((l) => [l.doc_type, l])
  )

  return (
    <Dialog
      open
      onOpenChange={() => {
        /* 不可关闭：onOpenChange 空实现，Esc/点击遮罩都无法关闭，
           必须逐项确认后才能继续 */
      }}
      showCloseButton={false}
      title={t('Our terms have been updated')}
      description={t(
        'Please review and agree to the updated documents to continue.'
      )}
      contentClassName='max-w-lg'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <Button
          className='w-full justify-center'
          disabled={!allChecked || mutation.isPending}
          onClick={() =>
            mutation.mutate(pending.map((p) => p.doc_type as PolicyType))
          }
        >
          {t('Agree and continue')}
        </Button>
      }
    >
      {hasBlocking && (
        <div className='border-warning/30 bg-warning/10 text-warning-foreground flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px]'>
          <AlertTriangle className='mt-0.5 size-4 shrink-0' />
          <span>
            {t(
              'API access is paused until you accept the updated terms. The console remains available.'
            )}
          </span>
        </div>
      )}
      <div className='border-border/60 divide-border/60 divide-y rounded-lg border'>
        {pending.map((p) => {
          const doc = contentByType.get(p.doc_type)
          return (
            <div
              key={p.doc_type}
              className='flex items-start gap-3 px-3.5 py-3'
            >
              <Checkbox
                id={`reconsent-${p.doc_type}`}
                checked={Boolean(checked[p.doc_type])}
                onCheckedChange={(v) =>
                  setChecked((prev) => ({
                    ...prev,
                    [p.doc_type]: v === true,
                  }))
                }
                className='mt-0.5'
              />
              <Label
                htmlFor={`reconsent-${p.doc_type}`}
                className='text-muted-foreground gap-1 text-left text-[13px] leading-5 font-normal'
              >
                <span>
                  {t('I have read and agree to the')}{' '}
                  {doc ? (
                    <PolicyViewerDialog
                      title={p.title}
                      content={doc.content}
                      trigger={
                        <button
                          type='button'
                          className='text-primary underline-offset-2 hover:underline'
                        >
                          {p.title}
                        </button>
                      }
                    />
                  ) : (
                    <span className='text-foreground'>{p.title}</span>
                  )}{' '}
                  <span className='text-muted-foreground/60'>
                    ({t('v{{n}}', { n: p.latest_version })})
                  </span>
                </span>
              </Label>
            </div>
          )
        })}
      </div>
    </Dialog>
  )
}

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
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  addCustomerPolicy,
  deleteCustomerPolicy,
  getCustomerPolicies,
  type CustomerPolicy,
} from '../../customer-policy'

interface CustomerPolicyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  username?: string
}

type NewPolicyForm = {
  vendor_id: string
  channel_id: string
  model_name: string
  discount_ratio: string
  max_concurrency: string
  rpm_limit: string
  priority: string
}

const emptyForm: NewPolicyForm = {
  vendor_id: '',
  channel_id: '',
  model_name: '',
  discount_ratio: '1',
  max_concurrency: '',
  rpm_limit: '',
  priority: '',
}

export function CustomerPolicyDialog(props: CustomerPolicyDialogProps) {
  const { t } = useTranslation()
  const [policies, setPolicies] = useState<CustomerPolicy[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<NewPolicyForm>(emptyForm)

  const refresh = async () => {
    setLoading(true)
    try {
      setPolicies(await getCustomerPolicies(props.userId))
    } catch {
      toast.error(t('Failed to load policies'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (props.open) {
      setForm(emptyForm)
      void refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.userId])

  const numOr = (s: string, dflt: number) => {
    const n = Number(s)
    return Number.isFinite(n) ? n : dflt
  }

  const handleAdd = async () => {
    const discount = numOr(form.discount_ratio, 1)
    if (discount < 0 || discount > 10) {
      toast.error(t('Discount must be between 0 and 10'))
      return
    }
    setSaving(true)
    try {
      const res = await addCustomerPolicy({
        user_id: props.userId,
        vendor_id: numOr(form.vendor_id, 0),
        channel_id: numOr(form.channel_id, 0),
        model_name: form.model_name.trim(),
        discount_ratio: discount,
        max_concurrency: numOr(form.max_concurrency, 0),
        rpm_limit: numOr(form.rpm_limit, 0),
        priority: numOr(form.priority, 0),
      })
      if (res.success) {
        toast.success(t('Policy added'))
        setForm(emptyForm)
        await refresh()
      } else {
        toast.error(res.message || t('Failed to add policy'))
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('Failed to add policy'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await deleteCustomerPolicy(id)
      if (res.success) {
        toast.success(t('Policy deleted'))
        await refresh()
      } else {
        toast.error(res.message || t('Failed to delete policy'))
      }
    } catch {
      toast.error(t('Failed to delete policy'))
    }
  }

  const anyLabel = t('0 = any')

  const renderPolicyList = () => {
    if (loading) {
      return (
        <div className='text-muted-foreground text-sm'>{t('Loading...')}</div>
      )
    }
    if (policies.length === 0) {
      return (
        <div className='text-muted-foreground text-sm'>
          {t('No policies configured')}
        </div>
      )
    }
    return (
      <div className='divide-border divide-y rounded-md border text-sm'>
        <div className='text-muted-foreground grid grid-cols-7 gap-2 px-3 py-2 font-medium'>
          <span>{t('Vendor ID')}</span>
          <span>{t('Channel ID')}</span>
          <span>{t('Model')}</span>
          <span>{t('Discount')}</span>
          <span>{t('Max Concurrency')}</span>
          <span>{t('RPM Limit')}</span>
          <span className='text-right'>{t('Action')}</span>
        </div>
        {policies.map((p) => (
          <div
            key={p.id}
            className='grid grid-cols-7 items-center gap-2 px-3 py-2'
          >
            <span>{p.vendor_id || '*'}</span>
            <span>{p.channel_id || '*'}</span>
            <span className='truncate'>{p.model_name || '*'}</span>
            <span>{p.discount_ratio}</span>
            <span>{p.max_concurrency || '-'}</span>
            <span>{p.rpm_limit || '-'}</span>
            <span className='text-right'>
              <Button
                variant='ghost'
                size='icon-sm'
                aria-label={t('Delete')}
                onClick={() => handleDelete(p.id)}
              >
                <Trash2 className='text-destructive size-4' />
              </Button>
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        props.username
          ? `${t('Customer Policies')} — ${props.username}`
          : t('Customer Policies')
      }
      description={t(
        'Per-customer discount (by vendor) and concurrency / RPM limits (by channel). 0 / empty / * = any; model supports prefix like claude-*.'
      )}
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <Button variant='outline' onClick={() => props.onOpenChange(false)}>
          {t('Close')}
        </Button>
      }
    >
      <div className='space-y-4'>
        {/* 现有策略列表 */}
        <div className='space-y-2'>
          <Label>{t('Existing policies')}</Label>
          {renderPolicyList()}
        </div>

        {/* 新增策略 */}
        <div className='space-y-2 border-t pt-4'>
          <Label>{t('Add policy')}</Label>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
            <div className='space-y-1'>
              <Label className='text-muted-foreground text-xs'>
                {t('Vendor ID')} ({anyLabel})
              </Label>
              <Input
                type='number'
                value={form.vendor_id}
                onChange={(e) =>
                  setForm({ ...form, vendor_id: e.target.value })
                }
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-muted-foreground text-xs'>
                {t('Channel ID')} ({anyLabel})
              </Label>
              <Input
                type='number'
                value={form.channel_id}
                onChange={(e) =>
                  setForm({ ...form, channel_id: e.target.value })
                }
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-muted-foreground text-xs'>
                {t('Model')} (* )
              </Label>
              <Input
                value={form.model_name}
                placeholder='claude-*'
                onChange={(e) =>
                  setForm({ ...form, model_name: e.target.value })
                }
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-muted-foreground text-xs'>
                {t('Discount')} (1=100%)
              </Label>
              <Input
                type='number'
                step={0.01}
                value={form.discount_ratio}
                onChange={(e) =>
                  setForm({ ...form, discount_ratio: e.target.value })
                }
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-muted-foreground text-xs'>
                {t('Max Concurrency')}
              </Label>
              <Input
                type='number'
                value={form.max_concurrency}
                onChange={(e) =>
                  setForm({ ...form, max_concurrency: e.target.value })
                }
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-muted-foreground text-xs'>
                {t('RPM Limit')}
              </Label>
              <Input
                type='number'
                value={form.rpm_limit}
                onChange={(e) =>
                  setForm({ ...form, rpm_limit: e.target.value })
                }
              />
            </div>
          </div>
          <div className='flex justify-end'>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? t('Processing...') : t('Add policy')}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

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
import { zodResolver } from '@hookform/resolvers/zod'
import { Code2, Palette, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useGroups } from '../hooks/use-groups'
import { useUpdateOption } from '../hooks/use-update-option'

// 分组×模型限流：JSON 形如
// {"default": [{"model": "claude-*", "max_concurrency": 5, "rpm_limit": 60}]}
// 对分组内每个用户各自生效；模型支持精确 / 前缀"claude-*" / 通配"*"。

type LimitRule = {
  model: string
  max_concurrency: number
  rpm_limit: number
}

// 可视化编辑用的扁平行：group + 规则
type FlatRule = LimitRule & { group: string }

const isRuleShape = (r: unknown): r is LimitRule => {
  if (typeof r !== 'object' || r === null) return false
  const o = r as Record<string, unknown>
  const numOk = (v: unknown) =>
    v === undefined || (typeof v === 'number' && v >= 0)
  return (
    (o.model === undefined || typeof o.model === 'string') &&
    numOk(o.max_concurrency) &&
    numOk(o.rpm_limit)
  )
}

const isValidLimitJSON = (value: string | undefined) => {
  if (!value || value.trim() === '') return true
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return false
    }
    for (const rules of Object.values(parsed)) {
      if (!Array.isArray(rules)) return false
      if (!rules.every(isRuleShape)) return false
    }
    return true
  } catch {
    return false
  }
}

const parseToFlatRules = (value: string): FlatRule[] => {
  if (!value || value.trim() === '') return []
  try {
    const parsed = JSON.parse(value) as Record<string, LimitRule[]>
    return Object.entries(parsed).flatMap(([group, rules]) =>
      (Array.isArray(rules) ? rules : []).map((r) => ({
        group,
        model: r.model ?? '',
        max_concurrency: r.max_concurrency ?? 0,
        rpm_limit: r.rpm_limit ?? 0,
      }))
    )
  } catch {
    return []
  }
}

const serializeFlatRules = (rows: FlatRule[]): string => {
  const grouped: Record<string, LimitRule[]> = {}
  for (const row of rows) {
    const group = row.group.trim()
    if (!group) continue
    grouped[group] ??= []
    grouped[group].push({
      model: row.model.trim(),
      max_concurrency: row.max_concurrency,
      rpm_limit: row.rpm_limit,
    })
  }
  return Object.keys(grouped).length === 0 ? '{}' : JSON.stringify(grouped)
}

function GroupModelLimitVisualEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  // 分组从系统分组列表中选择，避免手输出错；已保存但列表中不存在的
  // 分组名（如分组被删除）仍展示，避免打开编辑器就丢配置
  const { groups } = useGroups()
  const [rows, setRows] = useState<FlatRule[]>(() => parseToFlatRules(value))

  // 外部值变化（如表单 reset / JSON 模式编辑后切回）时重建行
  useEffect(() => {
    setRows(parseToFlatRules(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const update = (next: FlatRule[]) => {
    setRows(next)
    onChange(serializeFlatRules(next))
  }

  const setRow = (index: number, patch: Partial<FlatRule>) => {
    update(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const intOr0 = (s: string) => {
    const n = Number.parseInt(s, 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  return (
    <div className='space-y-2'>
      {rows.length > 0 && (
        <div className='divide-border divide-y rounded-md border text-sm'>
          <div className='text-muted-foreground grid grid-cols-[1fr_1.4fr_1fr_1fr_auto] gap-2 px-3 py-2 text-xs font-medium'>
            <span>{t('Group')}</span>
            <span>{t('Model')}</span>
            <span>{t('Max Concurrency')}</span>
            <span>{t('RPM Limit')}</span>
            <span className='w-8' />
          </div>
          {rows.map((row, index) => (
            <div
              // eslint-disable-next-line react-x/no-array-index-key
              key={index}
              className='grid grid-cols-[1fr_1.4fr_1fr_1fr_auto] items-center gap-2 px-3 py-2'
            >
              <Select
                value={row.group || undefined}
                onValueChange={(v) => setRow(index, { group: v ?? '' })}
              >
                <SelectTrigger className='h-8 w-full'>
                  <SelectValue placeholder={t('Select a group')} />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {[...new Set([...groups, row.group])]
                    .filter(Boolean)
                    .map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input
                value={row.model}
                placeholder='claude-*'
                onChange={(e) => setRow(index, { model: e.target.value })}
                className='h-8'
              />
              <Input
                type='number'
                min={0}
                value={row.max_concurrency || ''}
                placeholder={t('Unlimited')}
                onChange={(e) =>
                  setRow(index, { max_concurrency: intOr0(e.target.value) })
                }
                className='h-8'
              />
              <Input
                type='number'
                min={0}
                value={row.rpm_limit || ''}
                placeholder={t('Unlimited')}
                onChange={(e) =>
                  setRow(index, { rpm_limit: intOr0(e.target.value) })
                }
                className='h-8'
              />
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label={t('Delete')}
                onClick={() => update(rows.filter((_, i) => i !== index))}
              >
                <Trash2 className='text-destructive size-4' />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() =>
          update([
            ...rows,
            { group: '', model: '*', max_concurrency: 0, rpm_limit: 0 },
          ])
        }
      >
        <Plus className='mr-1 h-4 w-4' />
        {t('Add rule')}
      </Button>
    </div>
  )
}

const createSchema = (t: (key: string) => string) =>
  z.object({
    GroupModelLimit: z
      .string()
      .optional()
      .refine(isValidLimitJSON, {
        message: t('Invalid JSON format or values out of allowed range'),
      }),
  })

type GroupModelLimitFormValues = z.infer<ReturnType<typeof createSchema>>

type GroupModelLimitSectionProps = {
  defaultValues: GroupModelLimitFormValues
}

export function GroupModelLimitSection({
  defaultValues,
}: GroupModelLimitSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [useVisualEditor, setUseVisualEditor] = useState(true)

  const form = useForm<GroupModelLimitFormValues>({
    resolver: zodResolver(createSchema(t)),
    mode: 'onChange',
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const onSubmit = async (values: GroupModelLimitFormValues) => {
    if (values.GroupModelLimit !== defaultValues.GroupModelLimit) {
      await updateOption.mutateAsync({
        key: 'GroupModelLimit',
        value: values.GroupModelLimit ?? '',
      })
    }
  }

  return (
    <SettingsSection title={t('Group Model Limits')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save group model limits'
          />
          <FormField
            control={form.control}
            name='GroupModelLimit'
            render={({ field }) => (
              <FormItem>
                <div className='flex items-center justify-between'>
                  <FormLabel>
                    {t('Concurrency and RPM limits by group and model')}
                  </FormLabel>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => setUseVisualEditor(!useVisualEditor)}
                  >
                    {useVisualEditor ? (
                      <>
                        <Code2 className='mr-2 h-4 w-4' />
                        {t('JSON Mode')}
                      </>
                    ) : (
                      <>
                        <Palette className='mr-2 h-4 w-4' />
                        {t('Visual Mode')}
                      </>
                    )}
                  </Button>
                </div>
                <FormControl>
                  {useVisualEditor ? (
                    <GroupModelLimitVisualEditor
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  ) : (
                    <Textarea
                      rows={8}
                      placeholder={`{\n  "default": [\n    {"model": "claude-*", "max_concurrency": 5, "rpm_limit": 60}\n  ]\n}`}
                      className='font-mono text-sm'
                      {...field}
                    />
                  )}
                </FormControl>
                <FormDescription>
                  {t(
                    'Limits apply per user within the group: with 5 concurrency for model A, every user in the group gets 5 concurrent requests for A. Model supports exact name, prefix like claude-*, or * for all; the most specific matching rule wins, and models covered by the same rule share one counter. 0 = unlimited.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}

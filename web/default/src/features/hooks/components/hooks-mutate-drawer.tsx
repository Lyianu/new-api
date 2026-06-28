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
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { JsonCodeEditor } from '@/components/json-code-editor'
import { MultiSelect } from '@/components/multi-select'
import {
  SideDrawerSection,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { createHook, updateHook, getHook } from '../api'
import {
  SUCCESS_MESSAGES,
  getHookEventOptions,
  getHookTypeOptions,
  getHookModeOptions,
  getHookFailModeOptions,
} from '../constants'
import {
  getHookFormSchema,
  type HookFormValues,
  HOOK_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformHookToFormDefaults,
} from '../lib'
import { type Hook } from '../types'
import { useHooks } from './hooks-provider'

type HooksMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Hook
}

export function HooksMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: HooksMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useHooks()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const eventOptions = useMemo(() => getHookEventOptions(t), [t])
  const typeOptions = useMemo(() => getHookTypeOptions(t), [t])
  const modeOptions = useMemo(() => getHookModeOptions(t), [t])
  const failModeOptions = useMemo(() => getHookFailModeOptions(t), [t])

  const form = useForm<HookFormValues>({
    resolver: zodResolver(getHookFormSchema(t)),
    defaultValues: HOOK_FORM_DEFAULT_VALUES,
  })

  // Load fresh data when updating; reset to defaults when creating.
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      getHook(currentRow.id).then((result) => {
        if (result.success && result.data) {
          form.reset(transformHookToFormDefaults(result.data))
        }
      })
    } else if (open && !isUpdate) {
      form.reset(HOOK_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: HookFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = transformFormDataToPayload(data)
      const result =
        isUpdate && currentRow
          ? await updateHook({ ...payload, id: currentRow.id })
          : await createHook(payload)

      if (result.success) {
        toast.success(
          t(
            isUpdate
              ? SUCCESS_MESSAGES.HOOK_UPDATED
              : SUCCESS_MESSAGES.HOOK_CREATED
          )
        )
        onOpenChange(false)
        triggerRefresh()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) form.reset()
      }}
    >
      <SheetContent className={sideDrawerContentClassName('sm:max-w-[640px]')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isUpdate ? t('Update Hook') : t('Create Hook')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update the hook by providing necessary info.')
              : t('Add a new hook by providing necessary info.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='hook-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Name')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('Enter a name')} />
                    </FormControl>
                    <FormDescription>
                      {t('Unique name for this hook')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Type')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select hook type')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          {typeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(
                        'webhook calls an external HTTP service; archive saves requests to a sink (e.g. Elasticsearch).'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='enabled'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between gap-3 rounded-lg border p-3 sm:p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel>{t('Enabled')}</FormLabel>
                      <FormDescription>
                        {t('Disabled hooks are not loaded into the pipeline.')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        className='shrink-0'
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='events'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Events')}</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={eventOptions}
                        selected={field.value}
                        onChange={field.onChange}
                        placeholder={t('Select events')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Lifecycle events this hook subscribes to. Phase 1 dispatches request.received.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            <SideDrawerSection>
              <FormField
                control={form.control}
                name='mode'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Execution Mode')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          {modeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(
                        'Synchronous hooks run inline and can block the request; asynchronous hooks run in the background.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='fail_mode'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Fail Mode')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          {failModeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(
                        'Fail closed blocks the request when the hook errors; fail open lets it through.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='timeout_ms'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Timeout (ms)')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='number'
                          min={0}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value, 10) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='priority'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Priority')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='number'
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value, 10) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Lower runs first')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </SideDrawerSection>

            <SideDrawerSection>
              <FormField
                control={form.control}
                name='match'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Match (JSON)')}</FormLabel>
                    <FormControl>
                      <JsonCodeEditor
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Optional filters, e.g. {"group":["cn"],"model":["gpt-4o"]}. Empty means match all.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='config'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Config (JSON)')}</FormLabel>
                    <FormControl>
                      <JsonCodeEditor
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Type-specific config. webhook: {"url":"https://..."}; archive: {"endpoint":"https://...","index":"..."}.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>
          </form>
        </Form>
        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose render={<Button variant='outline' />}>
            {t('Close')}
          </SheetClose>
          <Button form='hook-form' type='submit' disabled={isSubmitting}>
            {isSubmitting ? t('Saving...') : t('Save changes')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

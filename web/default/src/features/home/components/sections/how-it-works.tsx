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

import { AnimateInView } from '@/components/animate-in-view'

// 三步上手：与特性目录同一编辑式语言（编号/细线/无图标）。

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '01',
      title: t('Configure'),
      desc: t(
        'Add your API keys, set up channels and configure access permissions'
      ),
    },
    {
      num: '02',
      title: t('Connect'),
      desc: t(
        'Connect through OpenAI, Claude, Gemini, and other compatible API routes'
      ),
    },
    {
      num: '03',
      title: t('Monitor'),
      desc: t('Track usage, costs and performance with real-time analytics'),
    },
  ]

  return (
    <section className='relative z-10 px-6 pb-24 md:pb-32'>
      <div className='border-border/60 mx-auto max-w-6xl border-t pt-14 md:pt-20'>
        <div className='grid gap-12 lg:grid-cols-12'>
          <AnimateInView className='lg:col-span-4'>
            <p className='text-muted-foreground/60 mb-4 text-[11px] font-medium tracking-[0.22em] uppercase'>
              {t('How It Works')}
            </p>
            <h2 className='font-display text-3xl leading-[1.15] font-normal tracking-[-0.01em] md:text-[2.5rem]'>
              {t('Three steps to get started')}
            </h2>
          </AnimateInView>

          <div className='space-y-0 lg:col-span-8'>
            {steps.map((step, i) => (
              <AnimateInView
                key={step.num}
                delay={i * 100}
                animation='fade-up'
                className={
                  i === 0
                    ? 'grid grid-cols-[3rem_1fr] gap-4 pb-8'
                    : 'border-border/60 grid grid-cols-[3rem_1fr] gap-4 border-t py-8'
                }
              >
                <span className='text-accent-warm pt-1 font-mono text-xs'>
                  {step.num}
                </span>
                <div>
                  <h3 className='font-display text-xl font-normal'>
                    {step.title}
                  </h3>
                  <p className='text-muted-foreground mt-2 max-w-lg text-sm leading-[1.75]'>
                    {step.desc}
                  </p>
                </div>
              </AnimateInView>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

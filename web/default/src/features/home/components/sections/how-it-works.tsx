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

// 三步接入 + 一段真实可跑的代码——示范"改一个 base_url 就能用"，
// 这是页面上第二处也是最后一处代码，克制使用。

export function HowItWorks() {
  const { t } = useTranslation()
  // 真实可复制的 base_url：直接用当前站点域名，避免占位符的"demo 感"
  const apiBase =
    typeof window !== 'undefined'
      ? `${window.location.origin}/v1`
      : 'https://api.routerbay.com/v1'

  const steps = [
    {
      num: '01',
      title: t('Create an account'),
      desc: t('Email sign-up, nothing else required'),
    },
    {
      num: '02',
      title: t('Top up in CNY'),
      desc: t('Pay as you go — no subscription, no minimum'),
    },
    {
      num: '03',
      title: t('Point your SDK at us'),
      desc: t('Change the base URL, keep your code'),
    },
  ]

  return (
    <section className='relative z-10 px-6 pb-24 md:pb-32'>
      <div className='border-border/60 mx-auto max-w-6xl border-t pt-14 md:pt-20'>
        <div className='grid gap-12 lg:grid-cols-12 lg:gap-10'>
          <div className='lg:col-span-5'>
            <AnimateInView>
              <p className='text-muted-foreground/60 mb-4 text-[11px] font-medium tracking-[0.22em] uppercase'>
                {t('How It Works')}
              </p>
              <h2 className='font-display text-3xl leading-[1.15] font-normal tracking-[-0.01em] md:text-[2.5rem]'>
                {t('Three steps to get started')}
              </h2>
            </AnimateInView>

            <div className='mt-10'>
              {steps.map((step, i) => (
                <AnimateInView
                  key={step.num}
                  delay={i * 100}
                  animation='fade-up'
                  className={
                    i === 0
                      ? 'grid grid-cols-[3rem_1fr] gap-4 pb-6'
                      : 'border-border/60 grid grid-cols-[3rem_1fr] gap-4 border-t py-6'
                  }
                >
                  <span className='text-accent-warm pt-0.5 font-mono text-xs'>
                    {step.num}
                  </span>
                  <div>
                    <h3 className='text-[15px] font-medium tracking-tight'>
                      {step.title}
                    </h3>
                    <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
                      {step.desc}
                    </p>
                  </div>
                </AnimateInView>
              ))}
            </div>
          </div>

          <AnimateInView
            animation='fade-up'
            delay={150}
            className='self-center lg:col-span-7 lg:pl-6'
          >
            <div className='border-border/70 bg-card overflow-hidden rounded-lg border shadow-[0_1px_2px_rgb(0_0_0/0.03)]'>
              <div className='border-border/60 text-muted-foreground/60 flex items-center justify-between border-b px-4 py-2.5 font-mono text-[11px]'>
                <span>main.py</span>
                <span>{t('OpenAI SDK compatible')}</span>
              </div>
              <pre className='overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.8]'>
                <code>
                  <span className='text-muted-foreground/55'>
                    from openai import OpenAI
                  </span>
                  {'\n\n'}
                  <span className='text-foreground/85'>client = OpenAI(</span>
                  {'\n'}
                  <span className='text-foreground/85'>
                    {'    base_url='}
                  </span>
                  <span className='text-accent-warm'>"{apiBase}"</span>
                  <span className='text-foreground/85'>,</span>
                  {'\n'}
                  <span className='text-foreground/85'>{'    api_key='}</span>
                  <span className='text-accent-warm'>"sk-rb-········"</span>
                  <span className='text-foreground/85'>,</span>
                  {'\n'}
                  <span className='text-foreground/85'>)</span>
                  {'\n\n'}
                  <span className='text-foreground/85'>
                    r = client.chat.completions.create(
                  </span>
                  {'\n'}
                  <span className='text-foreground/85'>{'    model='}</span>
                  <span className='text-accent-warm'>"claude-sonnet-5"</span>
                  <span className='text-foreground/85'>,</span>
                  {'\n'}
                  <span className='text-muted-foreground/55'>
                    {'    messages=[...],'}
                  </span>
                  {'\n'}
                  <span className='text-foreground/85'>)</span>
                </code>
              </pre>
            </div>
          </AnimateInView>
        </div>
      </div>
    </section>
  )
}

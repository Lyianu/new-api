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

import { LineReveal, Reveal, Stagger, StaggerItem } from '../../motion/primitives'

// 接入段：三步横排在上，真实可跑的代码在下。代码 base_url 取当前域名，
// 复制即用。

export function HowItWorks() {
  const { t } = useTranslation()
  const apiBase =
    typeof window !== 'undefined'
      ? `${window.location.origin}/v1`
      : 'https://api.routerbay.com/v1'

  const steps = [
    {
      title: t('Create an account'),
      desc: t('Email sign-up, nothing else required'),
    },
    {
      title: t('Top up in CNY'),
      desc: t('Pay as you go — no subscription, no minimum'),
    },
    {
      title: t('Point your SDK at us'),
      desc: t('Change the base URL, keep your code'),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-16 md:py-24'>
      <div className='mx-auto max-w-5xl'>
        <h2 className='max-w-2xl text-[clamp(1.85rem,4vw,3rem)] leading-[1.12] font-semibold tracking-[-0.03em]'>
          <LineReveal>{t('Three steps to get started')}</LineReveal>
        </h2>

        <Stagger className='mt-14 grid gap-x-10 gap-y-8 md:mt-20 md:grid-cols-3'>
          {steps.map((s, i) => (
            <StaggerItem
              key={s.title}
              className='border-border/70 border-t pt-6'
            >
              <span className='text-muted-foreground/40 text-[13px] font-medium tabular-nums'>
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className='mt-3 text-[17px] font-semibold tracking-tight'>
                {s.title}
              </h3>
              <p className='text-muted-foreground mt-2 text-[14px] leading-[1.75]'>
                {s.desc}
              </p>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.1} className='mx-auto mt-16 max-w-3xl md:mt-24'>
          <div className='border-border/80 bg-card overflow-hidden rounded-2xl border shadow-[0_1px_1px_rgb(0_0_0/0.02),0_8px_16px_-8px_rgb(0_0_0/0.06),0_28px_56px_-24px_rgb(0_0_0/0.1)]'>
            <div className='border-border/60 text-muted-foreground/60 flex items-center justify-between border-b px-5 py-3 font-mono text-[11px]'>
              <span>main.py</span>
              <span>{t('OpenAI SDK compatible')}</span>
            </div>
            <pre className='overflow-x-auto px-5 py-5 font-mono text-[13px] leading-[1.85]'>
              <code>
                <span className='text-muted-foreground/55'>
                  from openai import OpenAI
                </span>
                {'\n\n'}
                <span className='text-foreground/85'>client = OpenAI(</span>
                {'\n'}
                <span className='text-foreground/85'>{'    base_url='}</span>
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
        </Reveal>
      </div>
    </section>
  )
}

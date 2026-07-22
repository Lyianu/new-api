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

import { LineReveal, Reveal } from '../../motion/primitives'

interface FeaturesProps {
  className?: string
}

// 省心段：sticky 布局——左侧"一把钥匙"卡片钉在视口中，右侧三段文案
// 依次滚过。滚动本身成为叙事节奏。

function KeyCard() {
  const { t } = useTranslation()
  return (
    <div className='relative'>
      <div
        aria-hidden
        className='absolute inset-x-6 top-6 -bottom-6 -z-10 rounded-[1.5rem] bg-[radial-gradient(60%_60%_at_50%_40%,color-mix(in_oklch,var(--accent-warm)_6%,transparent),transparent_72%)]'
      />
      <div className='border-border/80 bg-card rounded-2xl border p-6 shadow-[0_1px_1px_rgb(0_0_0/0.02),0_8px_16px_-8px_rgb(0_0_0/0.06),0_28px_56px_-24px_rgb(0_0_0/0.1)]'>
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground text-[12px] tracking-[0.14em] uppercase'>
            API Key
          </span>
          <span className='bg-accent-warm size-1.5 rounded-full' />
        </div>
        <p className='mt-4 font-mono text-[17px] tracking-tight'>
          sk-rb-4f2a········9c1e
        </p>
        <div className='border-border/60 mt-6 border-t pt-5'>
          <p className='text-muted-foreground/60 text-[11px] tracking-[0.14em] uppercase'>
            {t('Callable models')}
          </p>
          <div className='mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[12px]'>
            <span>claude-sonnet-5</span>
            <span>claude-opus-4-8</span>
            <span>gpt-5</span>
            <span>gemini-2.5-pro</span>
            <span className='text-muted-foreground/50'>+ 40</span>
          </div>
        </div>
        <div className='border-border/60 text-muted-foreground mt-6 flex items-center justify-between border-t pt-4 text-[12px]'>
          <span>{t('Pay as you go')}</span>
          <span>{t('CNY billing')}</span>
        </div>
      </div>
    </div>
  )
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const points = [
    {
      title: t('One key, every model'),
      desc: t(
        'Integrate once with the OpenAI or Anthropic SDK you already use. Switch models by changing one string — no re-integration, ever.'
      ),
    },
    {
      title: t('No overseas hassle'),
      desc: t(
        'No foreign phone numbers, credit cards or account reviews. Sign up, top up in CNY, and start calling frontier models in minutes.'
      ),
    },
    {
      title: t('Stability we answer for'),
      desc: t(
        'Owning the supply means owning the uptime. Failures are ours to fix at the source, not to forward as excuses.'
      ),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-16 md:py-24'>
      <div className='mx-auto max-w-5xl'>
        <h2 className='max-w-2xl text-[clamp(1.85rem,4vw,3rem)] leading-[1.12] font-semibold tracking-[-0.03em]'>
          <LineReveal>{t('Everything between you')}</LineReveal>
          <LineReveal delay={0.08}>{t('and the model, handled.')}</LineReveal>
        </h2>

        <div className='mt-16 grid gap-16 md:mt-24 lg:grid-cols-2 lg:gap-20'>
          <div className='lg:self-start'>
            <div className='lg:sticky lg:top-28'>
              <Reveal>
                <KeyCard />
              </Reveal>
            </div>
          </div>

          <div>
            {points.map((p, i) => (
              <Reveal
                key={p.title}
                className={
                  i === 0
                    ? 'pb-16 lg:pb-28'
                    : 'border-border/70 border-t pt-16 pb-16 lg:pt-24 lg:pb-28'
                }
              >
                <h3 className='max-w-md text-[22px] leading-snug font-semibold tracking-[-0.015em]'>
                  {p.title}
                </h3>
                <p className='text-muted-foreground mt-4 max-w-md text-[15px] leading-[1.85]'>
                  {p.desc}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

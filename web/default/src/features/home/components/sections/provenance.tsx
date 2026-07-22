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

// 源头段：整个生意的立身之本——绝不掺水。
// 用一组对照链路把"自有源头 vs 层层转售"画清楚，不喊口号。

function ChainNode(props: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span
      className={
        props.dim
          ? 'border-border/50 text-muted-foreground/50 rounded-md border border-dashed px-3 py-1.5 font-mono text-[12px] whitespace-nowrap'
          : 'border-border bg-card text-foreground/85 rounded-md border px-3 py-1.5 font-mono text-[12px] whitespace-nowrap'
      }
    >
      {props.children}
    </span>
  )
}

function Arrow(props: { dim?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        props.dim
          ? 'text-muted-foreground/35 shrink-0 text-sm'
          : 'text-muted-foreground/60 shrink-0 text-sm'
      }
    >
      →
    </span>
  )
}

export function Provenance() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='border-border/60 mx-auto max-w-6xl border-t pt-14 md:pt-20'>
        <div className='grid gap-12 lg:grid-cols-12 lg:gap-10'>
          <AnimateInView className='lg:col-span-5'>
            <p className='text-muted-foreground/60 mb-4 text-[11px] font-medium tracking-[0.22em] uppercase'>
              {t('Why RouterBay')}
            </p>
            <h2 className='font-display text-3xl leading-[1.18] font-normal tracking-[-0.01em] text-balance md:text-[2.5rem]'>
              {t('The model you pay for is the model you get.')}
            </h2>
            <p className='text-muted-foreground mt-6 max-w-md text-[15px] leading-[1.85]'>
              {t(
                'Many resellers quietly substitute cheaper models for the ones you ordered. We operate our own first-party supply for every API we sell — there is no third party in the chain, and nowhere for substitution to hide.'
              )}
            </p>
          </AnimateInView>

          <div className='space-y-10 lg:col-span-7 lg:pt-2'>
            {/* 常见转售链路 */}
            <AnimateInView animation='fade-up'>
              <p className='text-muted-foreground/50 mb-4 text-[10.5px] font-medium tracking-[0.18em] uppercase'>
                {t('Typical reseller chain')}
              </p>
              <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
                <ChainNode dim>{t('Your application')}</ChainNode>
                <Arrow dim />
                <ChainNode dim>{t('Reseller')}</ChainNode>
                <Arrow dim />
                <ChainNode dim>{t('Another reseller')}</ChainNode>
                <Arrow dim />
                <ChainNode dim>?</ChainNode>
              </div>
              <p className='text-muted-foreground/50 mt-3 text-[13px] leading-relaxed'>
                {t(
                  'Each hop adds markup — and another place where your "GPT-5" can silently become something cheaper.'
                )}
              </p>
            </AnimateInView>

            {/* RouterBay 链路 */}
            <AnimateInView animation='fade-up' delay={120}>
              <p className='text-muted-foreground/50 mb-4 text-[10.5px] font-medium tracking-[0.18em] uppercase'>
                RouterBay
              </p>
              <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
                <ChainNode>{t('Your application')}</ChainNode>
                <Arrow />
                <ChainNode>RouterBay</ChainNode>
                <Arrow />
                <span className='border-border bg-card text-foreground/85 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[12px] whitespace-nowrap'>
                  <span className='bg-accent-warm size-1.5 rounded-full' />
                  {t('Official model source')}
                </span>
              </div>
              <p className='text-muted-foreground mt-3 text-[13px] leading-relaxed'>
                {t(
                  'One hop, owned by us. Quality and stability are ours to guarantee — and we do.'
                )}
              </p>
            </AnimateInView>
          </div>
        </div>
      </div>
    </section>
  )
}

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

// 立场段：一屏只讲一句话——绝不掺水。
// 大字宣言承担全部视觉，三条事实用细线目录收尾，不配任何图形。

export function Provenance() {
  const { t } = useTranslation()

  const facts = [
    {
      title: t('Straight from the source'),
      desc: t('Every API served from our own first-party supply'),
    },
    {
      title: t('No middlemen, no markup'),
      desc: t('One hop between you and the model — and it is ours'),
    },
    {
      title: t('Nowhere for substitution to hide'),
      desc: t('No third party in the chain that could swap your model'),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-28 md:py-40'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mx-auto max-w-4xl text-center'>
          <h2 className='text-[clamp(1.9rem,4.5vw,3.25rem)] leading-[1.15] font-semibold tracking-[-0.025em] text-balance'>
            {t('The model you pay for')}
            <br />
            <span className='text-muted-foreground/70'>
              {t('is the model you get.')}
            </span>
          </h2>
          <p className='text-muted-foreground mx-auto mt-8 max-w-xl text-[15px] leading-[1.85] md:text-[16px]'>
            {t(
              'Many resellers quietly substitute cheaper models for the ones you ordered. We operate our own first-party supply for every API we sell — there is no third party in the chain, and nowhere for substitution to hide.'
            )}
          </p>
        </AnimateInView>

        <div className='mx-auto mt-20 max-w-5xl md:mt-28'>
          <div className='grid gap-x-10 md:grid-cols-3'>
            {facts.map((f, i) => (
              <AnimateInView
                key={f.title}
                delay={i * 90}
                animation='fade-up'
                className='border-border/70 border-t pt-6 pb-4'
              >
                <h3 className='text-[15px] font-semibold tracking-tight'>
                  {f.title}
                </h3>
                <p className='text-muted-foreground mt-2 text-[14px] leading-[1.75]'>
                  {f.desc}
                </p>
              </AnimateInView>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

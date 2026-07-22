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

interface FeaturesProps {
  className?: string
}

// 省心段：编号目录式。三条各自对应一种接入前的顾虑。

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      num: '01',
      title: t('One key, every model'),
      desc: t(
        'Integrate once with the OpenAI or Anthropic SDK you already use. Switch models by changing one string — no re-integration, ever.'
      ),
    },
    {
      num: '02',
      title: t('No overseas hassle'),
      desc: t(
        'No foreign phone numbers, credit cards or account reviews. Sign up, top up in CNY, and start calling frontier models in minutes.'
      ),
    },
    {
      num: '03',
      title: t('Stability we answer for'),
      desc: t(
        'Owning the supply means owning the uptime. Failures are ours to fix at the source, not to forward as excuses.'
      ),
    },
  ]

  return (
    <section className='relative z-10 px-6 pb-24 md:pb-32'>
      <div className='border-border/60 mx-auto max-w-6xl border-t pt-14 md:pt-20'>
        <AnimateInView className='mb-14 md:mb-20'>
          <p className='text-muted-foreground/60 mb-4 text-[11px] font-medium tracking-[0.22em] uppercase'>
            {t('Peace of mind')}
          </p>
          <h2 className='font-display max-w-xl text-3xl leading-[1.15] font-normal tracking-[-0.01em] md:text-[2.5rem]'>
            {t('Everything between you and the model, handled.')}
          </h2>
        </AnimateInView>

        <div className='grid gap-x-12 md:grid-cols-3'>
          {features.map((f, i) => (
            <AnimateInView
              key={f.num}
              delay={Math.min(i * 80, 240)}
              animation='fade-up'
              className='border-border/60 border-t py-8 md:py-10'
            >
              <span className='text-accent-warm font-mono text-xs'>
                {f.num}
              </span>
              <h3 className='font-display mt-4 text-xl font-normal tracking-[-0.005em]'>
                {f.title}
              </h3>
              <p className='text-muted-foreground mt-2.5 max-w-[38ch] text-sm leading-[1.8]'>
                {f.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}

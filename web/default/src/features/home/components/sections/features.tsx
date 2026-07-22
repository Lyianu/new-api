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

// 编辑式特性目录：编号 + 标题 + 描述，细线分隔。
// 有意不用图标与色块——排版本身即是视觉。

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      num: '01',
      title: t('Lightning Fast'),
      desc: t(
        'Optimized network architecture ensures millisecond response times'
      ),
    },
    {
      num: '02',
      title: t('Secure & Reliable'),
      desc: t(
        'Enterprise-grade security with comprehensive permission management'
      ),
    },
    {
      num: '03',
      title: t('Global Coverage'),
      desc: t('Multi-region deployment for stable global access'),
    },
    {
      num: '04',
      title: t('Developer Friendly'),
      desc: t('Compatible API routes for common AI application workflows'),
    },
    {
      num: '05',
      title: t('Transparent Billing'),
      desc: t('Pay-as-you-go with real-time usage monitoring'),
    },
    {
      num: '06',
      title: t('Team Collaboration'),
      desc: t('Multi-user management with flexible permission allocation'),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-14 md:mb-20'>
          <p className='text-muted-foreground/60 mb-4 text-[11px] font-medium tracking-[0.22em] uppercase'>
            {t('Core Features')}
          </p>
          <h2 className='font-display max-w-xl text-3xl leading-[1.15] font-normal tracking-[-0.01em] md:text-[2.5rem]'>
            {t('Built for developers,')} {t('designed for scale')}
          </h2>
        </AnimateInView>

        <div className='grid gap-x-12 md:grid-cols-2 lg:grid-cols-3'>
          {features.map((f, i) => (
            <AnimateInView
              key={f.num}
              delay={Math.min(i * 60, 240)}
              animation='fade-up'
              className='border-border/60 border-t py-8 md:py-10'
            >
              <span className='text-accent-warm font-mono text-xs'>
                {f.num}
              </span>
              <h3 className='font-display mt-4 text-xl font-normal tracking-[-0.005em]'>
                {f.title}
              </h3>
              <p className='text-muted-foreground mt-2.5 max-w-[36ch] text-sm leading-[1.75]'>
                {f.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}

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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

// 模型目录：精确的表式排版。悬停时整行浮起、行尾箭头滑入——
// 微交互只在指针之下发生，页面静止时完全安静。

const CATALOG = [
  { name: 'claude-sonnet-5', vendor: 'Anthropic', kind: 'Chat · Reasoning' },
  { name: 'claude-opus-4-8', vendor: 'Anthropic', kind: 'Chat · Reasoning' },
  { name: 'gpt-5', vendor: 'OpenAI', kind: 'Chat · Reasoning' },
  { name: 'gpt-image', vendor: 'OpenAI', kind: 'Image' },
  { name: 'gemini-2.5-pro', vendor: 'Google', kind: 'Chat · Multimodal' },
  { name: 'deepseek-v3', vendor: 'DeepSeek', kind: 'Chat' },
]

export function Models() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-6 py-28 md:py-40'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-12 flex flex-wrap items-end justify-between gap-6 md:mb-16'>
          <h2 className='text-[clamp(1.75rem,3.6vw,2.75rem)] leading-[1.15] font-semibold tracking-[-0.025em]'>
            {t('The frontier, on tap.')}
          </h2>
          <Link
            to='/sign-up'
            className='text-muted-foreground hover:text-foreground group pb-1.5 text-sm transition-colors'
          >
            {t('See full list and live pricing')}
            <span className='ml-1 inline-block transition-transform duration-200 group-hover:translate-x-0.5'>
              →
            </span>
          </Link>
        </AnimateInView>

        <AnimateInView animation='fade-up'>
          <div className='border-border/70 overflow-hidden rounded-xl border'>
            <div className='border-border/60 text-muted-foreground/50 bg-background hidden grid-cols-[2fr_1.2fr_1.4fr_auto] gap-x-6 border-b px-6 py-3 text-[11px] tracking-[0.14em] uppercase sm:grid'>
              <span>{t('Model')}</span>
              <span>{t('Vendor')}</span>
              <span>{t('Capabilities')}</span>
              <span className='w-24 text-right'>{t('Supply')}</span>
            </div>
            {CATALOG.map((m, i) => (
              <div
                key={m.name}
                className={
                  'group bg-card hover:bg-background grid cursor-default grid-cols-[1fr_auto] items-baseline gap-x-6 px-6 py-4.5 transition-colors duration-200 sm:grid-cols-[2fr_1.2fr_1.4fr_auto]' +
                  (i > 0 ? ' border-border/60 border-t' : '')
                }
              >
                <span className='font-mono text-[14.5px] tracking-tight'>
                  {m.name}
                </span>
                <span className='text-muted-foreground hidden text-[14px] sm:block'>
                  {m.vendor}
                </span>
                <span className='text-muted-foreground/70 hidden text-[13px] sm:block'>
                  {m.kind}
                </span>
                <span className='text-muted-foreground/80 flex w-24 items-center justify-end gap-2 text-[12px] whitespace-nowrap'>
                  <span className='bg-accent-warm size-1.5 rounded-full' />
                  {t('First-party')}
                </span>
              </div>
            ))}
          </div>
        </AnimateInView>

        <AnimateInView
          animation='fade-in'
          className='text-muted-foreground/60 mt-5 text-[13px]'
        >
          {t('And more — sign in for the full catalog and per-token pricing.')}
        </AnimateInView>
      </div>
    </section>
  )
}

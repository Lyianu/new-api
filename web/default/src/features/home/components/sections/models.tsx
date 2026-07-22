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

// 模型目录：细线行式陈列（编辑式，不用卡片）。每行右侧的
// 「源头直连」记号呼应 Provenance 段的承诺。

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
    <section className='relative z-10 px-6 pb-24 md:pb-32'>
      <div className='border-border/60 mx-auto max-w-6xl border-t pt-14 md:pt-20'>
        <AnimateInView className='mb-12 flex flex-wrap items-end justify-between gap-6 md:mb-16'>
          <div>
            <p className='text-muted-foreground/60 mb-4 text-[11px] font-medium tracking-[0.22em] uppercase'>
              {t('Model catalog')}
            </p>
            <h2 className='font-display text-3xl leading-[1.15] font-normal tracking-[-0.01em] md:text-[2.5rem]'>
              {t('The frontier, on tap.')}
            </h2>
          </div>
          <Link
            to='/sign-up'
            className='text-muted-foreground hover:text-foreground pb-1 text-sm transition-colors'
          >
            {t('See full list and live pricing')} ↗
          </Link>
        </AnimateInView>

        <div>
          {CATALOG.map((m, i) => (
            <AnimateInView
              key={m.name}
              delay={Math.min(i * 50, 200)}
              animation='fade-up'
              className='border-border/60 hover:bg-card group grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-t px-1 py-5 transition-colors sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] md:px-3'
            >
              <span className='font-mono text-[15px] tracking-tight'>
                {m.name}
              </span>
              <span className='text-muted-foreground hidden text-sm sm:block'>
                {m.vendor}
              </span>
              <span className='text-muted-foreground/70 hidden text-[13px] sm:block'>
                {m.kind}
              </span>
              <span className='text-muted-foreground/80 inline-flex items-center gap-2 text-[12px] whitespace-nowrap'>
                <span className='bg-accent-warm size-1.5 rounded-full' />
                {t('First-party source')}
              </span>
            </AnimateInView>
          ))}
          <div className='border-border/60 border-t' />
        </div>
      </div>
    </section>
  )
}

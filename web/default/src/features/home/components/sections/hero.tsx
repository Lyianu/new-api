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

import { Button } from '@/components/ui/button'

import { useParallax } from '../../hooks/use-parallax'
import { ConsolePanel } from '../console-panel'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

// 首屏：居中宣言（Apple 式大字 sans，一屏一句话）→ 产品面板。
// 面板带极轻的滚动视差，是页面动效的第一处，也刻意是最明显的一处。

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const parallaxRef = useParallax<HTMLDivElement>(0.05)

  return (
    <section className='relative z-10 overflow-hidden px-6 pt-32 pb-8 md:pt-40'>
      {/* 头顶极淡的暖光，几乎不可察觉，只为让白纸有呼吸 */}
      <div
        aria-hidden
        className='absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(50%_100%_at_50%_0%,color-mix(in_oklch,var(--accent-warm)_4%,transparent),transparent_75%)]'
      />

      <div className='mx-auto max-w-6xl'>
        <div className='mx-auto flex max-w-3xl flex-col items-center text-center'>
          <p
            className='landing-animate-fade-up text-muted-foreground mb-6 text-[13px] font-medium opacity-0'
            style={{ animationDelay: '0ms' }}
          >
            RouterBay
          </p>

          <h1
            className='landing-animate-fade-up text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.06] font-semibold tracking-[-0.03em] text-balance'
            style={{ animationDelay: '80ms' }}
          >
            {t('Frontier model APIs.')}
            <br />
            <span className='text-muted-foreground/80'>
              {t('One key, straight from the source.')}
            </span>
          </h1>

          <p
            className='landing-animate-fade-up text-muted-foreground mt-7 max-w-xl text-[16px] leading-[1.75] text-balance opacity-0 md:text-[17px]'
            style={{ animationDelay: '160ms' }}
          >
            {t(
              'Call OpenAI, Claude, Gemini and more through one API key. First-party supply with no intermediaries — the model you pay for is the model you get.'
            )}
          </p>

          <div
            className='landing-animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-3 opacity-0'
            style={{ animationDelay: '240ms' }}
          >
            {props.isAuthenticated ? (
              <Button
                className='h-11 rounded-full px-7 text-sm font-medium shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_4px_12px_-2px_rgb(0_0_0/0.18)] active:translate-y-0 active:scale-[0.98]'
                render={<Link to='/dashboard' />}
              >
                {t('Go to Dashboard')}
              </Button>
            ) : (
              <>
                <Button
                  className='h-11 rounded-full px-7 text-sm font-medium shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_4px_12px_-2px_rgb(0_0_0/0.18)] active:translate-y-0 active:scale-[0.98]'
                  render={<Link to='/sign-up' />}
                >
                  {t('Get your API key')}
                </Button>
                <Button
                  variant='ghost'
                  className='text-muted-foreground hover:text-foreground h-11 rounded-full px-5 text-sm font-medium'
                  render={<Link to='/sign-in' />}
                >
                  {t('Sign in')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 产品面板：入场浮现 + 滚动视差 */}
        <div
          className='landing-animate-fade-up mx-auto mt-16 max-w-4xl opacity-0 md:mt-20'
          style={{ animationDelay: '340ms' }}
        >
          <div ref={parallaxRef} className='will-change-transform'>
            <ConsolePanel />
          </div>
        </div>

        {/* 供应商行：安静的信任带 */}
        <div className='mx-auto mt-16 max-w-4xl md:mt-20'>
          <p className='text-muted-foreground/45 text-center text-[12px] tracking-[0.14em] uppercase'>
            {t('Serving models from')}
          </p>
          <div className='text-muted-foreground/60 mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-[15px] font-medium'>
            <span>OpenAI</span>
            <span>Anthropic</span>
            <span>Google</span>
            <span>DeepSeek</span>
            <span>Qwen</span>
          </div>
        </div>
      </div>
    </section>
  )
}

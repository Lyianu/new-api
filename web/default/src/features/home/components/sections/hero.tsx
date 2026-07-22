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

import { RouteDiagram } from '../route-diagram'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

// 首屏：宣言式衬线标题 + 路由示意图。下方是四条承诺带——
// 我们不编造用户量数字，用可以兑现的承诺代替浮夸的大数。

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  const claims = [
    {
      title: t('Straight from the source'),
      desc: t('Every API served from our own first-party supply'),
    },
    {
      title: t('One key, every model'),
      desc: t('Integrate once, call all frontier models'),
    },
    {
      title: t('Works out of the box'),
      desc: t('No overseas accounts or foreign payments needed'),
    },
    {
      title: t('Honest metering'),
      desc: t('Pay as you go, every request itemized'),
    },
  ]

  return (
    <section className='relative z-10 px-6 pt-28 md:pt-36 lg:pt-40'>
      <div className='mx-auto max-w-6xl'>
        <div className='grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-10'>
          <div className='flex flex-col items-start lg:col-span-6'>
            <div
              className='landing-animate-fade-up text-muted-foreground/60 mb-7 text-[11px] font-medium tracking-[0.22em] uppercase opacity-0'
              style={{ animationDelay: '0ms' }}
            >
              RouterBay
            </div>

            <h1
              className='landing-animate-fade-up font-display text-[clamp(2.5rem,5vw,3.9rem)] leading-[1.1] font-normal tracking-[-0.015em] text-balance'
              style={{ animationDelay: '60ms' }}
            >
              {t('Frontier model APIs.')}
              <br />
              {t('One key, straight from the source.')}
            </h1>

            <p
              className='landing-animate-fade-up text-muted-foreground mt-7 max-w-md text-[15px] leading-[1.85] opacity-0'
              style={{ animationDelay: '120ms' }}
            >
              {t(
                'Call OpenAI, Claude, Gemini and more through one API key. First-party supply with no intermediaries — the model you pay for is the model you get.'
              )}
            </p>

            <div
              className='landing-animate-fade-up mt-10 flex flex-wrap items-center gap-4 opacity-0'
              style={{ animationDelay: '180ms' }}
            >
              {props.isAuthenticated ? (
                <Button
                  className='h-11 rounded-full px-7 text-sm font-medium'
                  render={<Link to='/dashboard' />}
                >
                  {t('Go to Dashboard')}
                </Button>
              ) : (
                <>
                  <Button
                    className='h-11 rounded-full px-7 text-sm font-medium'
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

          <div
            className='landing-animate-fade-up w-full opacity-0 lg:col-span-6'
            style={{ animationDelay: '260ms' }}
          >
            <RouteDiagram />
          </div>
        </div>

        {/* 承诺带 */}
        <div className='border-border/60 mt-20 border-t md:mt-28'>
          <div className='grid grid-cols-2 gap-x-8 gap-y-8 py-10 md:grid-cols-4 md:py-12'>
            {claims.map((c) => (
              <div key={c.title}>
                <div className='text-[15px] font-medium tracking-tight'>
                  {c.title}
                </div>
                <div className='text-muted-foreground mt-1.5 text-[13px] leading-relaxed'>
                  {c.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

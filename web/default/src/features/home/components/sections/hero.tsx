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
import { useStatus } from '@/hooks/use-status'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

// 编辑式落地页首屏：大衬线标题 + 静态代码面板。
// 克制是整页的设计语言——没有图标堆砌、没有打字机动画、没有渐变。

function CodePanel() {
  return (
    <div className='border-border/70 bg-card w-full overflow-hidden rounded-lg border shadow-[0_1px_2px_rgb(0_0_0/0.03)]'>
      <div className='border-border/60 text-muted-foreground/60 flex items-center justify-between border-b px-4 py-2.5 font-mono text-[11px]'>
        <span>POST /v1/chat/completions</span>
        <span>200 OK</span>
      </div>
      <pre className='overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.75]'>
        <code>
          <span className='text-muted-foreground/55'>
            {'curl https://api.example.com/v1/chat/completions \\'}
          </span>
          {'\n'}
          <span className='text-muted-foreground/55'>
            {'  -H "Authorization: Bearer $API_KEY" \\'}
          </span>
          {'\n'}
          <span className='text-muted-foreground/55'>{'  -d @- <<EOF'}</span>
          {'\n'}
          <span className='text-foreground/85'>{'{'}</span>
          {'\n'}
          <span className='text-foreground/85'>{'  "model": '}</span>
          <span className='text-accent-warm'>"claude-sonnet-5"</span>
          <span className='text-foreground/85'>,</span>
          {'\n'}
          <span className='text-foreground/85'>
            {'  "messages": [{"role": "user",'}
          </span>
          {'\n'}
          <span className='text-foreground/85'>
            {'                "content": "Hello"}]'}
          </span>
          {'\n'}
          <span className='text-foreground/85'>{'}'}</span>
          {'\n'}
          <span className='text-muted-foreground/55'>EOF</span>
        </code>
      </pre>
    </div>
  )
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  const docsIsExternal = docsUrl.startsWith('http')

  return (
    <section className='relative z-10 px-6 pt-28 pb-20 md:pt-36 md:pb-28 lg:pt-44'>
      <div className='mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-12'>
        <div className='flex flex-col items-start lg:col-span-7'>
          <div
            className='landing-animate-fade-up text-muted-foreground/60 mb-7 text-[11px] font-medium tracking-[0.22em] uppercase opacity-0'
            style={{ animationDelay: '0ms' }}
          >
            {t('AI Application Infrastructure Foundation')}
          </div>

          <h1
            className='landing-animate-fade-up font-display text-[clamp(2.75rem,5.5vw,4.25rem)] leading-[1.08] font-normal tracking-[-0.015em] text-balance'
            style={{ animationDelay: '60ms' }}
          >
            {t('Unified API Gateway for')}{' '}
            {t('Vast Range of AI Models')}
          </h1>

          <p
            className='landing-animate-fade-up text-muted-foreground mt-7 max-w-lg text-[15px] leading-[1.8] opacity-0'
            style={{ animationDelay: '120ms' }}
          >
            {t(
              'Access a vast selection of models via a standard, unified API protocol. Power AI applications, manage digital assets, and connect the Future.'
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
                  {t('Get Started')}
                </Button>
                <Button
                  variant='ghost'
                  className='text-foreground/80 hover:text-foreground h-11 rounded-full px-5 text-sm font-medium'
                  render={<Link to='/sign-in' />}
                >
                  {t('Sign in')}
                </Button>
              </>
            )}
            <Button
              variant='ghost'
              className='text-muted-foreground hover:text-foreground h-11 rounded-full px-5 text-sm font-medium'
              render={
                docsIsExternal ? (
                  <a href={docsUrl} target='_blank' rel='noopener noreferrer' />
                ) : (
                  <Link to={docsUrl} />
                )
              }
            >
              {t('Docs')} ↗
            </Button>
          </div>

          {/* 支持的应用：纯文字行，去图标胶囊 */}
          <div
            className='landing-animate-fade-up border-border/60 mt-14 w-full border-t pt-5 opacity-0'
            style={{ animationDelay: '240ms' }}
          >
            <div className='text-muted-foreground/50 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[13px]'>
              <span className='text-[10.5px] font-medium tracking-[0.18em] uppercase'>
                {t('Supported Applications')}
              </span>
              <a
                href='https://cherry-ai.com'
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-foreground transition-colors'
              >
                Cherry Studio
              </a>
              <a
                href='https://ccswitch.io'
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-foreground transition-colors'
              >
                CC Switch
              </a>
              <span>Claude Code</span>
              <span>Codex</span>
              <span>{t('More Apps')}</span>
            </div>
          </div>
        </div>

        <div
          className='landing-animate-fade-up w-full opacity-0 lg:col-span-5'
          style={{ animationDelay: '300ms' }}
        >
          <CodePanel />
        </div>
      </div>
    </section>
  )
}

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
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { ConsolePanel } from '../console-panel'
import { EASE } from '../../motion/ease'
import { LineReveal } from '../../motion/primitives'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

// 首屏：行遮罩揭示的大标题 + 随滚动进度连续"沉降就位"的产品面板。
// 面板的缩放/位移/透视都绑定在滚动进度上（scrubbed），是页面的主动效——
// 不是淡入，而是随手指移动逐帧演进。

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()

  const panelWrapRef = useRef<HTMLDivElement>(null)
  // 面板从"进入视口前"到"完全进入"这段滚动里连续演进
  const { scrollYProgress } = useScroll({
    target: panelWrapRef,
    offset: ['start 0.9', 'end 0.55'],
  })
  const p = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.4,
  })
  const scale = useTransform(p, [0, 1], [0.9, 1])
  const y = useTransform(p, [0, 1], [72, 0])
  const rotateX = useTransform(p, [0, 1], [10, 0])
  const opacity = useTransform(p, [0, 0.4], [0, 1])

  const docsUrl = 'https://docs.newapi.pro'

  return (
    <section className='relative z-10 overflow-hidden px-6 pt-32 pb-10 md:pt-44'>
      {/* 头顶极淡暖光，仅为让画布呼吸 */}
      <div
        aria-hidden
        className='absolute inset-x-0 top-0 -z-10 h-[36rem] bg-[radial-gradient(48%_100%_at_50%_0%,color-mix(in_oklch,var(--accent-warm)_5%,transparent),transparent_72%)]'
      />

      <div className='mx-auto max-w-5xl'>
        <div className='mx-auto flex max-w-3xl flex-col items-center text-center'>
          <motion.p
            className='text-muted-foreground/60 mb-7 text-[12px] font-medium tracking-[0.24em] uppercase'
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            RouterBay
          </motion.p>

          <h1 className='text-[clamp(2.75rem,6.4vw,5rem)] leading-[1.04] font-semibold tracking-[-0.035em]'>
            <LineReveal delay={0.05}>{t('Frontier model APIs.')}</LineReveal>
            <LineReveal delay={0.16} className='text-muted-foreground/70'>
              {t('One key, straight from the source.')}
            </LineReveal>
          </h1>

          <motion.p
            className='text-muted-foreground mt-8 max-w-xl text-[16px] leading-[1.75] text-balance md:text-[17px]'
            initial={reduce ? false : { opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={
              reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }
            }
            transition={{ duration: 0.9, ease: EASE, delay: 0.4 }}
          >
            {t(
              'Call OpenAI, Claude, Gemini and more through one API key. First-party supply with no intermediaries — the model you pay for is the model you get.'
            )}
          </motion.p>

          <motion.div
            className='mt-10 flex flex-wrap items-center justify-center gap-3'
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}
          >
            {props.isAuthenticated ? (
              <Button
                className='h-11 rounded-full px-7 text-sm font-medium shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_-4px_rgb(0_0_0/0.22)] active:translate-y-0 active:scale-[0.98]'
                render={<Link to='/dashboard' />}
              >
                {t('Go to Dashboard')}
              </Button>
            ) : (
              <>
                <Button
                  className='h-11 rounded-full px-7 text-sm font-medium shadow-[0_1px_2px_rgb(0_0_0/0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_-4px_rgb(0_0_0/0.22)] active:translate-y-0 active:scale-[0.98]'
                  render={<Link to='/sign-up' />}
                >
                  {t('Get your API key')}
                </Button>
                <Button
                  variant='ghost'
                  className='text-muted-foreground hover:text-foreground h-11 rounded-full px-5 text-sm font-medium'
                  render={<a href={docsUrl} target='_blank' rel='noreferrer' />}
                >
                  {t('Read the docs')}
                </Button>
              </>
            )}
          </motion.div>
        </div>

        {/* 产品面板：滚动进度驱动的沉降就位 */}
        <div ref={panelWrapRef} className='mt-16 md:mt-24' style={{ perspective: 1200 }}>
          <motion.div
            style={
              reduce
                ? undefined
                : { scale, y, rotateX, opacity, transformOrigin: '50% 0%' }
            }
            className='mx-auto max-w-4xl will-change-transform'
          >
            <ConsolePanel />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

'use client';

import { motion, useReducedMotion, useTransform } from 'motion/react';
import { useRef } from 'react';
import BoardWall from './BoardWall';
import { byId } from './copy';
import useSceneProgress from './useSceneProgress';

// Sections one and two, as one camera move.
//
// A room, drawn. A screen in it, blank. The scroll pushes the camera into
// that screen until it is the whole window, the room fades as it goes, and
// what was inside the screen turns out to be the wall of postings. Then the
// second headline arrives over it.
//
// The trick is that the wall never moves or scales. It is a full-size layer
// sitting behind the artwork the entire time, revealed through a rectangular
// hole that starts exactly on the drawn screen and grows until it is the
// window. So the "zoom" is the room getting bigger and the hole in it opening
// up, not the wall getting closer. If the wall scaled with the zoom it would
// end on one enormous card instead of on all of them.
//
// Everything below is in percentages of the artwork rather than pixels, so
// the maths holds at any window size.

// Measured off public/brand/desk.webp, which is 1881 x 836.
const ART = { w: 1881, h: 836 };
const SCREEN = { left: 43.81, top: 40.67, right: 70.23, bottom: 73.09 };
const ORIGIN = { x: 57.02, y: 56.88 };

// Far enough that the hole clears the corners of the window: the top edge
// reaches zero at 3.51 and the left at 4.32.
const MAX = 4.6;

// Long enough to read as a move rather than a jump, short enough that nobody
// wonders whether the page has stopped working.
const SCENE_VH = 300;

export default function DeskScene() {
  const wrap = useRef(null);
  const reduced = useReducedMotion();
  const one = byId('everywhere');
  const two = byId('pileup');

  const scrollYProgress = useSceneProgress(wrap);

  // The push. Still at first, so the room and its headline can be read, then
  // accelerating in.
  const scale = useTransform(scrollYProgress, [0.12, 0.72], [1, MAX]);

  // The hole, tracking that same scale exactly. A point p moves to
  // origin + (p - origin) * scale, so each edge is one line of arithmetic and
  // the hole cannot drift away from the drawn bezel.
  //
  // Written out rather than looped: four edges, each measured from its own
  // side of the box, and a helper would have to be a hook to read `scale`.
  const insetTop = useTransform(scale, (s) => Math.max(0, ORIGIN.y - (ORIGIN.y - SCREEN.top) * s));
  const insetRight = useTransform(scale, (s) => Math.max(0, (100 - ORIGIN.x) - (SCREEN.right - ORIGIN.x) * s));
  const insetBottom = useTransform(scale, (s) => Math.max(0, (100 - ORIGIN.y) - (SCREEN.bottom - ORIGIN.y) * s));
  const insetLeft = useTransform(scale, (s) => Math.max(0, ORIGIN.x - (ORIGIN.x - SCREEN.left) * s));
  const clipPath = useTransform(
    [insetTop, insetRight, insetBottom, insetLeft],
    ([t, r, b, l]) => `inset(${t}% ${r}% ${b}% ${l}%)`,
  );

  // The room leaves in the second half of the push, softening as it goes,
  // which is what a camera does and a scale on its own does not.
  const roomFade = useTransform(scrollYProgress, [0.42, 0.7], [1, 0]);
  const roomBlur = useTransform(scrollYProgress, [0.42, 0.7], ['blur(0px)', 'blur(10px)']);

  const headOne = useTransform(scrollYProgress, [0, 0.1, 0.24], [1, 1, 0]);
  const headOneY = useTransform(scrollYProgress, [0.1, 0.24], [0, -28]);
  const headTwo = useTransform(scrollYProgress, [0.74, 0.86], [0, 1]);
  const headTwoY = useTransform(scrollYProgress, [0.74, 0.86], [26, 0]);

  // No camera for anyone who asked for less motion: the room, then the wall
  // with its headline, as two plain sections.
  if (reduced) return <Still one={one} two={two} />;

  return (
    <div ref={wrap} id="everywhere" style={{ height: `${SCENE_VH}vh` }} className="tw:relative">
      <div className="tw:sticky tw:top-0 tw:h-[100svh] tw:w-full tw:overflow-hidden tw:bg-paper">
        {/* The artwork box: the image's own proportions, sized to cover the
            window, centred. Everything else is a percentage of this, which is
            what keeps the hole on the bezel at any size. */}
        <div
          className="tw:absolute tw:left-1/2 tw:top-1/2 tw:-translate-x-1/2 tw:-translate-y-1/2"
          style={{
            aspectRatio: `${ART.w} / ${ART.h}`,
            width: `max(100vw, calc(100svh * ${ART.w / ART.h}))`,
          }}
        >
          {/* The wall, full size and perfectly still, seen through the hole. */}
          <motion.div className="tw:absolute tw:inset-0" style={{ clipPath }}>
            <div className="tw:absolute tw:inset-0 tw:bg-paper" />
            <BoardWall fill />
          </motion.div>

          {/* The room, on top, growing and leaving. */}
          <motion.img
            src="/brand/desk.webp"
            alt="A student at a desk, working at a computer"
            draggable={false}
            className="tw:absolute tw:inset-0 tw:h-full tw:w-full tw:select-none"
            style={{
              scale,
              opacity: roomFade,
              filter: roomBlur,
              transformOrigin: `${ORIGIN.x}% ${ORIGIN.y}%`,
            }}
          />
        </div>

        {/* Ground for the second headline.
            It arrives over a wall of cards, which is the busiest thing on the
            page, and dark type on that is unreadable however big it is. So
            the right half becomes paper and the wall is only seen on the
            left. The seam is a gradient rather than an edge, or the split
            reads as two screenshots side by side.
            Below md there is no room for a column of each, so it goes back to
            paper across the top and the text sits on that. */}
        <motion.div
          aria-hidden
          style={{ opacity: headTwo }}
          className="tw:pointer-events-none tw:absolute tw:inset-0"
        >
          <div
            className="tw:absolute tw:inset-x-0 tw:top-0 tw:h-[52svh] tw:md:hidden"
            style={{
              background:
                'linear-gradient(to bottom, #f5f5f0 0%, rgba(245,245,240,0.94) 42%, rgba(245,245,240,0) 100%)',
            }}
          />
          <div
            className="tw:absolute tw:inset-y-0 tw:right-0 tw:hidden tw:w-[56%] tw:md:block"
            style={{
              // Solid well before the text starts. The text column begins at
              // 56% of the stage and this panel at 44%, so paper has to be
              // opaque by a fifth of the way across it or the headline sits
              // on half-seen cards.
              background:
                'linear-gradient(to right, rgba(245,245,240,0) 0%, rgba(245,245,240,0.88) 10%, #f5f5f0 20%)',
            }}
          />
        </motion.div>

        {/* The first headline is centred over the room. The second sits in
            the paper half, beside the wall rather than on top of it. */}
        <motion.header
          style={{ opacity: headOne, y: headOneY }}
          className="tw:pointer-events-none tw:absolute tw:inset-x-0 tw:top-[14svh] tw:mx-auto tw:max-w-3xl tw:px-6 tw:text-center"
        >
          <Head head={one.head} sub={one.sub} />
        </motion.header>

        <motion.header
          style={{ opacity: headTwo, y: headTwoY }}
          className="tw:pointer-events-none tw:absolute tw:inset-x-0 tw:top-[14svh] tw:mx-auto tw:max-w-5xl tw:px-6 tw:text-center tw:md:inset-y-0 tw:md:left-auto tw:md:right-0 tw:md:flex tw:md:w-[44%] tw:md:max-w-none tw:md:flex-col tw:md:justify-center tw:md:px-10 tw:md:text-left tw:lg:px-14"
        >
          <Head head={two.head} sub={two.sub} split />
        </motion.header>
      </div>
    </div>
  );
}

// `split` is the headline that shares the screen with the wall: half the
// width, so it sets smaller and its written-in line breaks are dropped. The
// breaks were chosen to stop a full-width line splitting badly; in a column
// they would leave a very short second line.
function Head({ head, sub, split = false }) {
  const lines = Array.isArray(head) ? head : [head];
  const size = split
    ? 'tw:text-[clamp(1.6rem,2.6vw,2.3rem)] tw:text-balance'
    : lines.length > 1
      ? 'tw:text-[clamp(1.7rem,3.6vw,2.7rem)]'
      : 'tw:text-[clamp(1.9rem,5vw,3.4rem)] tw:text-balance';

  return (
    <>
      <h2 className={`tw:m-0 tw:font-[family-name:var(--landing-display)] tw:font-semibold tw:leading-[1.08] tw:tracking-[-0.03em] tw:text-ink ${size}`}>
        {split
          ? lines.join(' ')
          : lines.map((l) => <span key={l} className="tw:block">{l}</span>)}
      </h2>
      <p className="tw:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.6vw,1.2rem)] tw:leading-relaxed tw:text-muted tw:text-balance">
        {sub}
      </p>
    </>
  );
}

// The same content with the camera taken out.
function Still({ one, two }) {
  return (
    <>
      <section id="everywhere" className="tw:flex tw:min-h-[100svh] tw:flex-col tw:items-center tw:justify-center tw:gap-10 tw:px-6 tw:py-24">
        <header className="tw:max-w-3xl tw:text-center"><Head head={one.head} sub={one.sub} /></header>
        <img src="/brand/desk.webp" alt="A student at a desk, working at a computer"
          className="tw:w-full tw:max-w-4xl" />
      </section>
      <section id="pileup" className="tw:flex tw:min-h-[100svh] tw:flex-col tw:items-center tw:justify-center tw:gap-10 tw:overflow-hidden tw:px-6 tw:py-24">
        <header className="tw:max-w-5xl tw:text-center"><Head head={two.head} sub={two.sub} /></header>
        <div className="tw:w-full tw:max-w-6xl"><BoardWall /></div>
      </section>
    </>
  );
}

'use client';

import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
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

// The room is a short piece of film rather than a still: it plays for two and
// a half seconds while the opening line is up, then freezes and the push
// begins. Freezing matters. The clip drifts in on its own, and a camera of
// its own moving while ours does would be two shots fighting.
const ART = { w: 1280, h: 720 };
const FREEZE_AT = 2.5;

// Measured off the frame at FREEZE_AT. The clip drifts, but the monitor does
// not move within it: the rect comes out identical at 2.5s and 3.5s, so
// shortening the hold does not need a new measurement.
const SCREEN = { left: 44.14, top: 38.75, right: 77.5, bottom: 70 };
const ORIGIN = { x: 60.82, y: 54.37 };

// Far enough that the hole clears every corner. The left edge reaches zero at
// 3.65 and the top at 3.48, which are the two that hold out longest.
const MAX = 3.7;

// Long enough to read as a move rather than a jump, short enough that nobody
// wonders whether the page has stopped working.
const SCENE_VH = 300;

export default function DeskScene() {
  const wrap = useRef(null);
  const reduced = useReducedMotion();
  const one = byId('everywhere');
  const two = byId('pileup');

  const raw = useSceneProgress(wrap);

  // Wheels and trackpads deliver scroll in lumps, and a transform driven
  // straight off them steps rather than moves. The spring rides over the
  // lumps without feeling detached: stiff enough to stay with the finger,
  // damped past one so it never overshoots and rubber-bands the zoom.
  const scrollYProgress = useSpring(raw, { stiffness: 220, damping: 40, mass: 0.35, restDelta: 0.0005 });
  const film = useRef(null);

  // Play the first few seconds, then hold on the frame the measurements were
  // taken from. Muted, because a landing page that makes a noise is a landing
  // page people close, and because nothing else would be allowed to autoplay.
  useEffect(() => {
    const v = film.current;
    if (!v) return undefined;

    const stop = () => {
      if (v.currentTime >= FREEZE_AT) {
        v.pause();
        v.currentTime = FREEZE_AT;
      }
    };
    v.addEventListener('timeupdate', stop);

    if (reduced) {
      // No film either: the frame the push is measured from, and nothing else.
      const hold = () => { v.currentTime = FREEZE_AT; v.pause(); };
      v.readyState >= 1 ? hold() : v.addEventListener('loadedmetadata', hold, { once: true });
    } else {
      v.play().catch(() => {
        // Autoplay refused. The frame is still what matters, so hold it.
        v.currentTime = FREEZE_AT;
      });
    }
    return () => v.removeEventListener('timeupdate', stop);
  }, [reduced]);

  // Four beats, a quarter of the scene each, so each one is its own scroll
  // rather than everything sliding at once:
  //
  //   0.00 - 0.40  the room, then the push
  //   0.40 - 0.60  the wall on its own, saying nothing
  //   0.60 - 0.72  the words fade in
  //   0.72 - 1.00  nothing moves at all
  //
  // That last quarter is the point of the arrangement. Nothing on screen
  // changes through it, so the words are read standing still and the next
  // scroll is what carries the page on, rather than something that happens
  // while they are still being read.
  const scale = useTransform(scrollYProgress, [0.08, 0.4], [1, MAX]);

  // The hole is a box that grows, not a clip-path that is recomputed.
  //
  // clip-path with animated insets repaints a full-screen layer on every
  // frame, which is most of what made the push stutter. A transform does not:
  // it composites. So the window onto the wall is an element sitting exactly
  // on the drawn bezel, scaled by the same factor as the film, with the wall
  // inside scaled by the inverse so it never moves or grows.
  //
  // The window's own centre is the screen's centre, which is the point the
  // film is scaled about, so the two grow in lockstep and there is no
  // arithmetic left: transform-origin is the default centre on both.
  const counter = useTransform(scale, (v) => 1 / v);

  // The room leaves earlier than it used to, and for a reason beyond taste:
  // the clip is 720p, so past about 2.5x it is visibly soft, and the fade and
  // the blur are what carry it out before that shows. It also softens as it
  // goes, which is what a camera does and a scale on its own does not.
  const roomFade = useTransform(scrollYProgress, [0.16, 0.36], [1, 0]);
  const roomBlur = useTransform(scrollYProgress, [0.16, 0.36], ['blur(0px)', 'blur(7px)']);

  const headOne = useTransform(raw, [0, 0.05, 0.17], [1, 1, 0]);
  const headOneY = useTransform(raw, [0.05, 0.17], [0, -28]);
  // The wall gets a beat to itself before this. That beat is the volume;
  // words over it straight away would explain it before it has been felt.
  // Fades, and does not move. Type sliding up while the page is being
  // scrolled up reads as the page shifting under you rather than as words
  // arriving, which is exactly what it should not do here.
  const headTwo = useTransform(raw, [0.6, 0.72], [0, 1]);

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
          <motion.div
            className="tw:absolute tw:overflow-hidden"
            style={{
              left: `${SCREEN.left}%`,
              top: `${SCREEN.top}%`,
              width: `${SCREEN.right - SCREEN.left}%`,
              height: `${SCREEN.bottom - SCREEN.top}%`,
              scale,
              willChange: 'transform',
            }}
          >
            {/* Counter-scaled, and laid out large enough that at 1/scale it
                still covers the stage. Its layout size never changes, so the
                wall's rendered size never changes either. */}
            <motion.div
              className="tw:absolute tw:left-1/2 tw:top-1/2"
              style={{
                width: `${(100 / (SCREEN.right - SCREEN.left)) * 100}%`,
                height: `${(100 / (SCREEN.bottom - SCREEN.top)) * 100}%`,
                // Not -50%. Centring this on the window would centre the
                // wall on the screen, and the screen is not the middle of the
                // picture: it sits at ORIGIN, right of and below centre. This
                // shift is exactly that offset.
                x: `-${ORIGIN.x}%`,
                y: `-${ORIGIN.y}%`,
                scale: counter,
                // And the counter-scale has to turn about the same point the
                // window turns about, or it undoes the size but not the
                // position: a scale moves its children as well as resizing
                // them, so the wall crept left as the window grew. Expressed
                // in this element's own box, the window's centre is ORIGIN,
                // because this element is exactly the size of the artwork.
                transformOrigin: `${ORIGIN.x}% ${ORIGIN.y}%`,
                willChange: 'transform',
              }}
            >
              <div className="tw:absolute tw:inset-0 tw:bg-paper" />
              <BoardWall fill />
            </motion.div>
          </motion.div>

          {/* The room, on top, growing and leaving. */}
          <motion.video
            ref={film}
            src="/brand/desk.mp4"
            muted
            playsInline
            preload="auto"
            aria-hidden
            className="tw:absolute tw:inset-0 tw:h-full tw:w-full tw:object-cover tw:select-none"
            style={{
              scale,
              opacity: roomFade,
              filter: roomBlur,
              transformOrigin: `${ORIGIN.x}% ${ORIGIN.y}%`,
            }}
          />
        </div>

        {/* Ground for the second headline.
            A band at the foot of the screen, full width, fading up into the
            wall and solid paper by the bottom. It only has one edge to
            soften: the other one is the bottom of the window. The wall fills
            the rest of the screen above it, so the words are read from the
            floor of the thing they describe. */}
        <motion.div
          aria-hidden
          style={{ opacity: headTwo }}
          className="tw:pointer-events-none tw:absolute tw:inset-x-0 tw:bottom-0 tw:h-[42svh]"
        >
          <div
            className="tw:h-full tw:w-full"
            style={{
              background:
                'linear-gradient(to bottom, rgba(245,245,240,0) 0%, rgba(245,245,240,0.92) 28%, #f5f5f0 52%, #f5f5f0 100%)',
            }}
          />
        </motion.div>

        {/* The first headline sits high over the room. The second sits at
            the foot of the screen, with the wall running the full height
            above it. */}
        {/* Two layers, because two different things move it. The outer one
            is the scroll taking it away; the inner one is its arrival, which
            is on a timer rather than on the scroll so the room has a second
            of screen to itself before any words land on it. */}
        <motion.header
          style={{ opacity: headOne, y: headOneY }}
          className="tw:pointer-events-none tw:absolute tw:inset-x-0 tw:top-[12svh] tw:px-6 tw:text-center"
        >
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <Head head={one.head} big />
          </motion.div>
        </motion.header>

        <motion.header
          style={{ opacity: headTwo }}
          className="tw:pointer-events-none tw:absolute tw:inset-x-0 tw:bottom-[9svh] tw:mx-auto tw:max-w-5xl tw:px-6 tw:text-center"
        >
          <Head head={two.head} />
        </motion.header>
      </div>
    </div>
  );
}

// Three shapes of headline on this page.
//
// The opening one is set in #3f342f, which is his hair: sampled off the
// frozen frame rather than chosen, so it belongs to the picture it sits on.
// It reads at 10.4:1 against the room's wall, well past what it needs.
//
// `big` is the opening one: it carries the screen on its own, so it sets as
// large as it can while staying on one line. The nowrap is md and up only.
// Below that, 5.6vw of a phone is not enough for thirty characters and it has
// to be allowed to wrap rather than run off the side.
//
// `split` shares the screen with the wall, so it sets smaller and drops its
// written-in line breaks. Those breaks stop a full-width line splitting
// badly; in a half-width column they would strand a short line.
function Head({ head, sub, split = false, big = false }) {
  const lines = Array.isArray(head) ? head : [head];
  // Colour belongs in here rather than on the base class. Two Tailwind colour
  // utilities on one element are both a single class, so which wins is decided
  // by the order Tailwind emits them, not the order they are written: a
  // text-ink on the base quietly beat the hair colour set here.
  const size = big
    ? 'tw:text-[clamp(1.75rem,5vw,4.4rem)] tw:font-extrabold tw:text-[#3f342f] tw:md:whitespace-nowrap'
    : split
      ? 'tw:text-[clamp(1.6rem,2.6vw,2.3rem)] tw:font-bold tw:text-ink tw:text-balance'
      : lines.length > 1
        ? 'tw:text-[clamp(1.7rem,3.6vw,2.7rem)] tw:font-bold tw:text-ink tw:md:whitespace-nowrap'
        : 'tw:text-[clamp(1.9rem,5vw,3.4rem)] tw:font-bold tw:text-ink tw:text-balance';

  return (
    <>
      <h2 className={`tw:m-0 tw:font-[family-name:var(--landing-display)] tw:leading-[1.06] tw:tracking-[-0.035em] ${size}`}>
        {split || big
          ? lines.join(' ')
          : lines.map((l) => <span key={l} className="tw:block">{l}</span>)}
      </h2>
      {sub && (
        <p className="tw:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.6vw,1.2rem)] tw:leading-relaxed tw:text-muted tw:text-balance">
          {sub}
        </p>
      )}
    </>
  );
}

// The same content with the camera taken out.
function Still({ one, two }) {
  return (
    <>
      <section id="everywhere" className="tw:flex tw:min-h-[100svh] tw:flex-col tw:items-center tw:justify-center tw:gap-10 tw:px-6 tw:py-24">
        <header className="tw:max-w-3xl tw:text-center"><Head head={one.head} sub={one.sub} /></header>
        <video src="/brand/desk.mp4" muted playsInline aria-hidden
          className="tw:w-full tw:max-w-4xl" />
      </section>
      <section id="pileup" className="tw:flex tw:min-h-[100svh] tw:flex-col tw:items-center tw:justify-center tw:gap-10 tw:overflow-hidden tw:px-6 tw:py-24">
        <header className="tw:max-w-5xl tw:text-center"><Head head={two.head} sub={two.sub} /></header>
        <div className="tw:w-full tw:max-w-6xl"><BoardWall /></div>
      </section>
    </>
  );
}

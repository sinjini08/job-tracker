'use client';

import { motion } from 'motion/react';

// Everything on this page arrives the same way: up a little, and fading in,
// once, when it comes into view.
//
// One component rather than the same four props written twenty times, and one
// place to change the feel of the whole page.
//
// `once` matters. Re-animating on the way back up makes a long page feel like
// it is fighting you, and this page is seven screens tall.
export default function Reveal({ children, delay = 0, y = 18, className }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

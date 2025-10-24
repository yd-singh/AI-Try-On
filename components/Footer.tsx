/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const REMIX_SUGGESTIONS = [
	"🪩 Remix idea: Turn your looks into a digital lookbook that’s share-worthy (and a little brag-worthy).", 
	"🛍️ Remix idea: Link fashion to function — pull real products via an e-commerce API to shop the vibe.",
	"🕶️ Remix idea: Accessorize like an AI stylist — try adding shades, hats, or a statement bag.",
	"⭐ Remix idea: Give every outfit a style score — because data should serve the drama.",
	"💾 Remix idea: Save your slays — build a personal closet of your top AI looks.",
	"🎨 Remix idea: Explore color magic — generate fresh palettes and alternate colorways for your fits."
];

interface FooterProps {
  isOnDressingScreen?: boolean;
}

const Footer: React.FC<FooterProps> = ({ isOnDressingScreen = false }) => {
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestionIndex((prevIndex) => (prevIndex + 1) % REMIX_SUGGESTIONS.length);
    }, 4000); // Change suggestion every 4 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <footer className={`fixed bottom-0 left-0 right-0 bg-slate-950/50 backdrop-blur-lg border-t border-slate-800/60 p-3 z-50 ${isOnDressingScreen ? 'hidden sm:block' : ''}`}>
      <div className="mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 max-w-7xl px-4">
        <p>
          Remixed by{' '}
          <a 
            href="https://www.linkedin.com/in/yashdeepsingh/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-semibold text-slate-100 hover:underline"
          >
            @yash
          </a>
        </p>
        <div className="h-4 mt-1 sm:mt-0 flex items-center overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={suggestionIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className="text-center sm:text-right"
              >
                {REMIX_SUGGESTIONS[suggestionIndex]}
              </motion.p>
            </AnimatePresence>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
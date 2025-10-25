/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import WardrobePanel from './components/WardrobeModal';
import OutfitStack from './components/OutfitStack';
import { generateVirtualTryOnImage, generatePoseVariation } from './services/geminiService';
import { OutfitLayer, WardrobeItem } from './types';
import { ChevronDownIcon, ChevronUpIcon } from './components/icons';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import { getFriendlyErrorMessage } from './lib/utils';
import Spinner from './components/Spinner';
import JSZip from 'jszip';

const POSE_INSTRUCTIONS = [
  "Full frontal view, hands on hips",
  "Slightly turned, 3/4 view",
  "Side profile view",
  "Jumping in the air, mid-action shot",
  "Walking towards camera",
  "Leaning against a wall",
];

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);

    // DEPRECATED: mediaQueryList.addListener(listener);
    mediaQueryList.addEventListener('change', listener);
    
    // Check again on mount in case it changed between initial state and effect runs
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }

    return () => {
      // DEPRECATED: mediaQueryList.removeListener(listener);
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query, matches]);

  return matches;
};

// Helper to convert a data URL to a Blob, necessary for zipping.
const dataURLtoBlob = (dataurl: string): Blob => {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) throw new Error('Invalid data URL');
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};


const App: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(isMobile);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);

  useEffect(() => {
    setIsSheetCollapsed(isMobile);
  }, [isMobile]);

  const activeOutfitLayers = useMemo(() => 
    outfitHistory.slice(0, currentOutfitIndex + 1), 
    [outfitHistory, currentOutfitIndex]
  );
  
  const activeItemIds = useMemo(() => 
    activeOutfitLayers.map(layer => layer.item?.id).filter(Boolean) as string[], 
    [activeOutfitLayers]
  );
  
  const displayImageUrl = useMemo(() => {
    if (outfitHistory.length === 0) return modelImageUrl;
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (!currentLayer) return modelImageUrl;

    const poseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
    // Return the image for the current pose, or fallback to the first available image for the current layer.
    // This ensures an image is shown even while a new pose is generating.
    return currentLayer.poseImages[poseInstruction] ?? Object.values(currentLayer.poseImages)[0];
  }, [outfitHistory, currentOutfitIndex, currentPoseIndex, modelImageUrl]);

  const availablePoseKeys = useMemo(() => {
    if (outfitHistory.length === 0) return [];
    const currentLayer = outfitHistory[currentOutfitIndex];
    return currentLayer ? Object.keys(currentLayer.poseImages) : [];
  }, [outfitHistory, currentOutfitIndex]);

  const handleModelFinalized = (url: string) => {
    setModelImageUrl(url);
    setOutfitHistory([{
      item: null,
      poseImages: { [POSE_INSTRUCTIONS[0]]: url }
    }]);
    setCurrentOutfitIndex(0);
  };

  const handleStartOver = () => {
    setModelImageUrl(null);
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setCurrentPoseIndex(0);
    setIsSheetCollapsed(isMobile);
    setWardrobe(defaultWardrobe);
  };

  const handleItemSelect = useCallback(async (itemFile: File, itemInfo: WardrobeItem) => {
    if (!displayImageUrl || isLoading) return;

    // Caching: Check if we are re-applying a previously generated layer
    const nextLayer = outfitHistory[currentOutfitIndex + 1];
    if (nextLayer && nextLayer.item?.id === itemInfo.id) {
        setCurrentOutfitIndex(prev => prev + 1);
        setCurrentPoseIndex(0); // Reset pose when changing layer
        return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Adding ${itemInfo.name}...`);

    try {
      const newImageUrl = await generateVirtualTryOnImage(displayImageUrl, itemFile, itemInfo.category);
      const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
      
      const newLayer: OutfitLayer = { 
        item: itemInfo, 
        poseImages: { [currentPoseInstruction]: newImageUrl } 
      };

      setOutfitHistory(prevHistory => {
        // Cut the history at the current point before adding the new layer
        const newHistory = prevHistory.slice(0, currentOutfitIndex + 1);
        return [...newHistory, newLayer];
      });
      setCurrentOutfitIndex(prev => prev + 1);
      
      // Add to personal wardrobe if it's not already there
      setWardrobe(prev => {
        if (prev.find(i => i.id === itemInfo.id)) {
            return prev;
        }
        return [...prev, itemInfo];
      });
      // Fix for error: Argument of type 'unknown' is not assignable to parameter of type 'string'.
    } catch (err: any) {
      // FIX: The `getFriendlyErrorMessage` function now accepts `unknown`.
      setError(getFriendlyErrorMessage(err, 'Failed to apply item'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, outfitHistory, currentOutfitIndex]);

  const handleRemoveLastItem = () => {
    if (currentOutfitIndex > 0) {
      setCurrentOutfitIndex(prevIndex => prevIndex - 1);
      setCurrentPoseIndex(0); // Reset pose to default when removing a layer
    }
  };
  
  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (isLoading || outfitHistory.length === 0 || newIndex === currentPoseIndex) return;
    
    const poseInstruction = POSE_INSTRUCTIONS[newIndex];
    const currentLayer = outfitHistory[currentOutfitIndex];

    // If pose already exists, just update the index to show it.
    if (currentLayer.poseImages[poseInstruction]) {
      setCurrentPoseIndex(newIndex);
      return;
    }

    // Pose doesn't exist, so generate it.
    // Use an existing image from the current layer as the base.
    const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0];
    if (!baseImageForPoseChange) return; // Should not happen

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing pose...`);
    
    const prevPoseIndex = currentPoseIndex;
    // Optimistically update the pose index so the pose name changes in the UI
    setCurrentPoseIndex(newIndex);

    try {
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction);
      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const updatedLayer = newHistory[currentOutfitIndex];
        updatedLayer.poseImages[poseInstruction] = newImageUrl;
        return newHistory;
      });
      // Fix for error: Argument of type 'unknown' is not assignable to parameter of type 'string'.
    } catch (err: any) {
      // FIX: The `getFriendlyErrorMessage` function now accepts `unknown`.
      setError(getFriendlyErrorMessage(err, 'Failed to change pose'));
      // Revert pose index on failure
      setCurrentPoseIndex(prevPoseIndex);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [currentPoseIndex, outfitHistory, isLoading, currentOutfitIndex]);

  const handleDownloadAllViews = useCallback(async () => {
    if (isLoading || outfitHistory.length === 0) return;

    setError(null);
    setIsLoading(true);

    try {
        const currentLayer = outfitHistory[currentOutfitIndex];
        const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0];

        const posesToGenerate = POSE_INSTRUCTIONS.filter(
            pose => !currentLayer.poseImages[pose]
        );
        
        const allPoseImages = { ...currentLayer.poseImages };

        if (posesToGenerate.length > 0) {
            setLoadingMessage(`Generating ${posesToGenerate.length} missing pose(s)...`);

            const generationPromises = posesToGenerate.map(poseInstruction => 
                generatePoseVariation(baseImageForPoseChange, poseInstruction)
                    .then(newImageUrl => ({ poseInstruction, newImageUrl }))
            );
            
            const generatedResults = await Promise.all(generationPromises);

            // Add new images to our temporary collection and update state in the background
            generatedResults.forEach(({ poseInstruction, newImageUrl }) => {
              allPoseImages[poseInstruction] = newImageUrl;
            });
            
            setOutfitHistory(prevHistory => {
                const newHistory = [...prevHistory];
                const updatedLayer = { ...newHistory[currentOutfitIndex] };
                // Create a new object for poseImages to ensure react detects the change
                updatedLayer.poseImages = { ...updatedLayer.poseImages }; 
                generatedResults.forEach(({ poseInstruction, newImageUrl }) => {
                    updatedLayer.poseImages[poseInstruction] = newImageUrl;
                });
                newHistory[currentOutfitIndex] = updatedLayer;
                return newHistory;
            });
        }
        
        setLoadingMessage('Packaging files for download...');
        await new Promise(resolve => setTimeout(resolve, 100)); // allow UI to update

        const zip = new JSZip();
        const outfitName = currentLayer.item?.name.replace(/\s/g, '_') || 'base_model';
        const folder = zip.folder(outfitName);
        if (!folder) throw new Error("Could not create zip folder");

        Object.entries(allPoseImages).forEach(([pose, imageUrl], index) => {
            const blob = dataURLtoBlob(imageUrl);
            const filename = `${index + 1}_${pose.replace(/[ ,/]/g, '_').toLowerCase()}.png`;
            folder.file(filename, blob);
        });

        const content = await zip.generateAsync({ type: 'blob' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${outfitName}_all_views.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    // Fix for error: Argument of type 'unknown' is not assignable to parameter of type 'string'.
    } catch (err: any) {
        setError(getFriendlyErrorMessage(err, 'Failed to download all views'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [isLoading, outfitHistory, currentOutfitIndex]);

  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <div className="font-sans">
      <AnimatePresence mode="wait">
        {!modelImageUrl ? (
          <motion.div
            key="start-screen"
            className="w-screen min-h-screen flex items-start sm:items-center justify-center bg-transparent p-4 pb-20"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen onModelFinalized={handleModelFinalized} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="relative flex flex-col h-screen bg-transparent overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <main className="flex-grow flex flex-col md:flex-row overflow-hidden">
              <div className="w-full flex-grow flex items-center justify-center bg-transparent relative">
                <Canvas 
                  displayImageUrl={displayImageUrl}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  onSelectPose={handlePoseSelect}
                  poseInstructions={POSE_INSTRUCTIONS}
                  currentPoseIndex={currentPoseIndex}
                  availablePoseKeys={availablePoseKeys}
                  onDownloadAllViews={handleDownloadAllViews}
                />
              </div>

              <aside 
                className={`flex-shrink-0 w-full md:w-1/3 md:max-w-sm bg-slate-900/50 backdrop-blur-lg flex flex-col border-t md:border-t-0 md:border-l border-slate-700/60 transition-all duration-500 ease-in-out overflow-hidden ${isSheetCollapsed ? 'h-14' : 'h-[60vh]'} md:h-full`}
              >
                  <button 
                    onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                    className="md:hidden w-full h-8 flex-shrink-0 flex items-center justify-center bg-slate-800/50"
                    aria-label={isSheetCollapsed ? 'Expand panel' : 'Collapse panel'}
                  >
                    {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-slate-400" /> : <ChevronDownIcon className="w-6 h-6 text-slate-400" />}
                  </button>
                  <div className="p-4 md:p-6 overflow-y-auto flex-grow flex flex-col gap-4 md:gap-8">
                    {error && (
                      <div className="bg-red-500/10 border-l-4 border-red-500 text-red-300 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                      </div>
                    )}
                    <OutfitStack 
                      outfitHistory={activeOutfitLayers}
                      onRemoveLastItem={handleRemoveLastItem}
                    />
                    <WardrobePanel
                      onItemSelect={handleItemSelect}
                      activeItemIds={activeItemIds}
                      isLoading={isLoading}
                      wardrobe={wardrobe}
                    />
                  </div>
              </aside>
            </main>
            <AnimatePresence>
              {isLoading && isMobile && (
                <motion.div
                  className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Spinner />
                  {loadingMessage && (
                    <p className="text-lg font-serif text-slate-200 mt-4 text-center px-4">{loadingMessage}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer isOnDressingScreen={!!modelImageUrl} />
    </div>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import SplashCursor from './components/ui/SplashCursor';

export const App: React.FC = () => {
  const [splashEnabled, setSplashEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('kernellens_splash_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [splashIntensity, setSplashIntensity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('kernellens_splash_intensity');
      return saved !== null ? parseFloat(saved) : 0.65;
    } catch {
      return 0.65;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('kernellens_splash_enabled', String(splashEnabled));
    } catch {}
  }, [splashEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('kernellens_splash_intensity', String(splashIntensity));
    } catch {}
  }, [splashIntensity]);

  return (
    <>
      {splashEnabled && (
        <SplashCursor
          rainbow={false}
          colors={['#00F2FE', '#00E5A3', '#38BDF8', '#0077FE']}
          theme="dark"
          size={0.65}
          intensity={splashIntensity}
          force={0.75 * (splashIntensity / 0.65)}
          swirl={2.5}
          trail={0.75}
          shading={0.8}
          glow={0.35}
          clickSplash={true}
          intro={false}
          zIndex={50}
        />
      )}
      <AppShell
        splashEnabled={splashEnabled}
        onToggleSplash={() => setSplashEnabled((prev) => !prev)}
        splashIntensity={splashIntensity}
        onChangeSplashIntensity={setSplashIntensity}
      />
    </>
  );
};

export default App;

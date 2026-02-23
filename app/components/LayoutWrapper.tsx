'use client';

import { usePathname } from 'next/navigation';
import BottomNav from './BottomNav';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Route che NON devono mostrare il BottomNav
  const hideBottomNavRoutes = ['/', '/auth', '/completamento-profilo'];
  const shouldShowBottomNav = !hideBottomNavRoutes.includes(pathname);

  return (
    <>
      <div className={shouldShowBottomNav ? 'pb-[53px]' : ''}>
        {children}
      </div>
      {/* Visualizza la barra di navigazione solo nelle pagine consentite */}
      {shouldShowBottomNav && <BottomNav userAvatar={null} />}
    </>
  );
}
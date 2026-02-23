'use client';

export default function PageBackground({ children }: { children: React.ReactNode }) {
  return (
    <main className="fixed inset-0 bg-black overflow-hidden" style={{ height: '100dvh' }}>
      {/* Sfondo nero profondo con gradiente radiale */}
      <div className="absolute inset-0 bg-black pointer-events-none">
        <div 
          className="absolute inset-0 opacity-80"
          style={{
            background: 'radial-gradient(circle at center, rgba(17, 24, 39, 0.8) 0%, rgba(0, 0, 0, 0.95) 50%, rgba(0, 0, 0, 1) 100%)'
          }}
        ></div>
      </div>

      {/* Effetto particelle dorate */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-yellow-400/30 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-1 h-1 bg-yellow-400/40 rounded-full animate-pulse delay-300"></div>
        <div className="absolute bottom-32 left-1/4 w-1.5 h-1.5 bg-yellow-400/20 rounded-full animate-pulse delay-700"></div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-yellow-400/30 rounded-full animate-pulse delay-500"></div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="scrollable-content relative z-10 h-[calc(100%-60px)]">
        {children}
      </div>
    </main>
  );
}

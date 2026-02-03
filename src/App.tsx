import { useState, useEffect } from 'react'
import { Field, FIELD_WIDTH_YARDS, TOTAL_LENGTH_YARDS, YARD_TO_PX } from '@/components/Field'
import { PlaybookSidebar } from '@/components/PlaybookSidebar'
import { PlayerToken } from '@/components/PlayerToken'
import { RoutePath } from '@/components/RoutePath'
import { generateRoutePoints } from '@/lib/routes'
import type { RoutePreset } from '@/lib/routes'
import type { Play, Player, Point, RouteType, RouteSegment } from '@/types'

function App() {
  const [plays, setPlays] = useState<Play[]>(() => {
    const saved = localStorage.getItem('savedPlays');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentPlayId, setCurrentPlayId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeRouteType, setActiveRouteType] = useState<RouteType>('primary');
  const [drawingType, setDrawingType] = useState<RouteType>('primary');
  const [activeRoutePoints, setActiveRoutePoints] = useState<Point[]>([]);

  const currentPlay = plays.find(p => p.id === currentPlayId);
  const selectedPlayer = currentPlay?.players.find(p => p.id === selectedPlayerId) || null;

  const updateCurrentPlay = (updatedPlay: Play) => {
    setPlays(plays.map(p => p.id === updatedPlay.id ? updatedPlay : p));
  };

  const S = 25;
  const TOTAL_H = 25; // yards
  const LOS_OFFSET = 5; // yards from bottom

  // Helper to get logic Y from yards relative to LOS
  const getPos = (xYards: number, yYardsFromLOS: number) => {
    // Center X (Field width 25y)
    const cx = (25 / 2) * S;
    const pxX = cx + xYards * S;

    // Y: 
    const yardsFromTop = TOTAL_H - (LOS_OFFSET + yYardsFromLOS);
    const pxY = yardsFromTop * S;

    return { x: pxX, y: pxY };
  };

  /* Player Positions Constants */
  /* Player Positions Constants */
  const POSITIONS = {
    'C': { role: 'C', label: 'C', x: 0, depth: -1, color: '#eab308' }, // Yellow
    'QB': { role: 'QB', label: 'QB', x: 0, depth: -4, color: '#ef4444' }, // Keep Red/Default? Or maybe neutral? User didn't specify.
    'WR-L': { role: 'WR-L', label: 'L', x: -10, depth: -1, color: '#3b82f6' }, // Blue (LR)
    'WR-R': { role: 'WR-R', label: 'R', x: 10, depth: -1, color: '#ef4444' }, // Red (RR)
    'SL': { role: 'SL', label: 'SL', x: -5, depth: -1, color: '#22c55e' }, // Green (Slot)
    'SR': { role: 'SR', label: 'SR', x: 5, depth: -1, color: '#22c55e' }, // Green (SR)
  };

  const handleNewPlay = () => {
    const defaultPlayers: Player[] = [
      { id: crypto.randomUUID(), role: 'C', label: 'C', color: POSITIONS['C'].color, position: getPos(0, -1), routes: [] },
      { id: crypto.randomUUID(), role: 'QB', label: 'QB', color: POSITIONS['QB'].color, position: getPos(0, -4), routes: [] },
      { id: crypto.randomUUID(), role: 'WR-L', label: 'L', color: POSITIONS['WR-L'].color, position: getPos(-10, -1), routes: [] },
      { id: crypto.randomUUID(), role: 'WR-R', label: 'R', color: POSITIONS['WR-R'].color, position: getPos(10, -1), routes: [] },
      { id: crypto.randomUUID(), role: 'SR', label: 'SR', color: POSITIONS['SR'].color, position: getPos(5, -1), routes: [] },
    ];

    const newPlay: Play = {
      id: crypto.randomUUID(),
      name: `Play ${plays.length + 1}`,
      players: defaultPlayers
    };
    const newPlays = [...plays, newPlay];
    setPlays(newPlays);
    setCurrentPlayId(newPlay.id);
    setSelectedPlayerId(null);
    setIsDrawing(false);
    setActiveRoutePoints([]);
  };

  const handleFormation = (type: 'strong-left' | 'strong-right') => {
    if (!currentPlay) return;

    // Common positions 
    const C = { role: 'C', label: 'C', position: getPos(0, -1) };
    const QB = { role: 'QB', label: 'QB', position: getPos(0, -4) };
    const WRL = { role: 'WR-L', label: 'L', position: getPos(-10, -1) };
    const WRR = { role: 'WR-R', label: 'R', position: getPos(10, -1) };
    // Slot dynamic
    const Slot = type === 'strong-left'
      ? { role: 'SL', label: 'SL', position: getPos(-5, -1) } // Between L (-10) and C (0)
      : { role: 'SR', label: 'SR', position: getPos(5, -1) }; // Between R (10) and C (0)

    const formations = [C, QB, WRL, WRR, Slot];

    const newPlayers = formations.map((f, i) => ({
      id: currentPlay.players[i]?.id || crypto.randomUUID(),
      role: f.role,
      label: f.label,
      color: currentPlay.players[i]?.color || '#ef4444',
      position: f.position,
      routes: []
    }));

    updateCurrentPlay({ ...currentPlay, players: newPlayers });
  };

  const handleAddPlayer = () => {
    if (!currentPlay) return;
    const centerPos = {
      x: (FIELD_WIDTH_YARDS / 2) * YARD_TO_PX,
      y: (TOTAL_LENGTH_YARDS / 2) * YARD_TO_PX
    };

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      role: 'P',
      label: `P${currentPlay.players.length + 1}`,
      color: '#3b82f6',
      position: centerPos,
      routes: []
    };

    const updatedPlayers = [...currentPlay.players, newPlayer];
    updateCurrentPlay({ ...currentPlay, players: updatedPlayers });
    setSelectedPlayerId(newPlayer.id);
  };

  const handleUpdatePlayer = (id: string, updates: Partial<Player>) => {
    if (!currentPlay) return;
    const updatedPlayers = currentPlay.players.map(p =>
      p.id === id ? { ...p, ...updates } : p
    );
    updateCurrentPlay({ ...currentPlay, players: updatedPlayers });
  };





  const handleSetPosition = (roleKey: string) => {
    if (!selectedPlayer || !currentPlay) return;

    const targetPosDef = POSITIONS[roleKey as keyof typeof POSITIONS];
    if (!targetPosDef) return;

    // Calculate base target pixel position
    const basePos = getPos(targetPosDef.x, targetPosDef.depth);

    // Collision Detection / Stacking
    let finalPos = { ...basePos };
    let collision = true;
    let attempts = 0;

    while (collision && attempts < 5) {
      // Check if any OTHER player is close to this position
      const isOccupied = currentPlay.players.some(p =>
        p.id !== selectedPlayer.id &&
        Math.abs(p.position.x - finalPos.x) < 5 && // Tolerance
        Math.abs(p.position.y - finalPos.y) < 5
      );

      if (isOccupied) {
        // Move back 1.5 yards
        // +Y is UP (visually down?), wait. 
        // getPos logic: yYardsFromLOS. -1 is behind. -2.5 is further behind.
        // Move next to each other (Right 1.5 yards)
        finalPos.x += (1.5 * S);
        attempts++;
      } else {
        collision = false;
      }
    }

    // Update Player
    const updatedPlayers = currentPlay.players.map(p =>
      p.id === selectedPlayer.id ? {
        ...p,
        role: targetPosDef.role,
        label: targetPosDef.label, // Auto-update label too? User said "Position" so likely yes.
        color: targetPosDef.color, // Auto-update color
        position: finalPos
      } : p
    );
    updateCurrentPlay({ ...currentPlay, players: updatedPlayers });
  };

  const handleApplyRoute = (preset: RoutePreset) => {
    if (!selectedPlayer || !currentPlay) return;

    // Center the start point (Now handled naturally since position is center)
    const startPos = selectedPlayer.position;

    const points = generateRoutePoints(startPos, preset);

    // Create new route segment
    const newRoute: RouteSegment = {
      id: crypto.randomUUID(),
      type: activeRouteType,
      points: points
    };

    // Replace only the route of the current type (or add if doesn't exist)
    const updatedPlayers = currentPlay.players.map(p =>
      p.id === selectedPlayer.id
        ? { ...p, routes: [...p.routes.filter(r => r.type !== activeRouteType), newRoute] }
        : p
    );
    updateCurrentPlay({ ...currentPlay, players: updatedPlayers });
  };

  const startDrawing = () => {
    if (!selectedPlayer) return;
    setDrawingType(activeRouteType);
    setIsDrawing(true);
    // Center start point (Now handled naturally)
    const startPos = selectedPlayer.position;
    setActiveRoutePoints([startPos]);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setActiveRoutePoints([]);
  };

  const addToRoute = (point: Point) => {
    if (!isDrawing) return;
    setActiveRoutePoints([...activeRoutePoints, point]);
  };

  const finishDrawing = () => {
    if (!isDrawing || !selectedPlayer || !currentPlay) return;
    const newRoute: RouteSegment = {
      id: crypto.randomUUID(),
      type: drawingType,
      points: activeRoutePoints
    };
    const updatedPlayers = currentPlay.players.map(p =>
      p.id === selectedPlayer.id
        ? { ...p, routes: [...p.routes.filter(r => r.type !== drawingType), newRoute] }
        : p
    );
    updateCurrentPlay({ ...currentPlay, players: updatedPlayers });
    setIsDrawing(false);
    setActiveRoutePoints([]);
  };

  const handleFieldClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) {
      if (selectedPlayerId) setSelectedPlayerId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addToRoute({ x, y });
  };

  const clearRoutes = () => {
    if (!selectedPlayer || !currentPlay) return;
    const updatedPlayers = currentPlay.players.map(p =>
      p.id === selectedPlayer.id ? { ...p, routes: [] } : p
    );
    updateCurrentPlay({ ...currentPlay, players: updatedPlayers });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isDrawing) finishDrawing();
      if (e.key === 'Escape') {
        if (isDrawing) cancelDrawing();
        else setSelectedPlayerId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, activeRoutePoints]);

  useEffect(() => {
    localStorage.setItem('savedPlays', JSON.stringify(plays));
  }, [plays]);

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden text-slate-100 font-sans select-none">
      <PlaybookSidebar
        plays={plays}
        currentPlayId={currentPlayId}
        selectedPlayer={selectedPlayer}
        onSelectPlay={(id) => {
          setCurrentPlayId(id);
          setSelectedPlayerId(null);
          cancelDrawing();
        }}
        onNewPlay={handleNewPlay}
        onSavePlay={() => localStorage.setItem('savedPlays', JSON.stringify(plays))}
        onDeletePlay={(id) => {
          const newPlays = plays.filter(p => p.id !== id);
          setPlays(newPlays);
          if (currentPlayId === id) setCurrentPlayId(null);
        }}
        onStartDrawing={startDrawing}
        onClearRoutes={clearRoutes}
        onAddPlayer={handleAddPlayer}
        onUpdatePlayer={handleUpdatePlayer}
        onSetFormation={handleFormation}
        onApplyRoute={handleApplyRoute}
        onSetPosition={handleSetPosition}
        activeRouteType={activeRouteType}
        onSetActiveRouteType={setActiveRouteType}
        isDrawing={isDrawing}
        onFinishDrawing={finishDrawing}
      />

      <main className="flex-1 flex flex-col items-center justify-center bg-slate-900 p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-950 z-0">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-slate-950 to-slate-950"></div>
        </div>

        <div className="z-10 flex flex-col items-center gap-4 h-full w-full justify-center">
          <div className="text-slate-300 font-mono text-sm flex gap-4 items-center">
            <span>{currentPlay ? currentPlay.name : "Select or create a play"}</span>
            {currentPlay && <span className="text-slate-500">| {currentPlay.players.length} Players</span>}
            {isDrawing && (
              <span className="bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded text-xs animate-pulse border border-yellow-500/30">
                DRAWING MODE (Click to add points, Enter to finish)
              </span>
            )}
          </div>

          <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-slate-700 p-1 bg-slate-800 relative">
            <Field onClick={handleFieldClick} className={isDrawing ? 'cursor-crosshair' : 'cursor-default'}>
              {/* Render Routes */}
              <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height="100%">
                {/* 1. Render Background Routes (Option, Check) */}
                {currentPlay?.players.map(player => (
                  player.routes.filter(r => r.type !== 'primary').map(route => (
                    <RoutePath
                      key={route.id}
                      segment={route}
                      color={player.color}
                      isSelected={selectedPlayerId === player.id}
                    />
                  ))
                ))}
                {/* 2. Render Foreground Routes (Primary) */}
                {currentPlay?.players.map(player => (
                  player.routes.filter(r => r.type === 'primary').map(route => (
                    <RoutePath
                      key={route.id}
                      segment={route}
                      color={player.color}
                      isSelected={selectedPlayerId === player.id}
                    />
                  ))
                ))}
                {/* Active Drawing Route (Always top) */}$SAME$
                {isDrawing && activeRoutePoints.length > 0 && (
                  <RoutePath
                    segment={{ id: 'drawing', type: drawingType, points: activeRoutePoints }}
                    color={selectedPlayer?.color || '#000'} // Ensure visible on white field
                    isSelected={true}
                  />
                )}
              </svg>

              {currentPlay?.players.map(player => (
                <PlayerToken
                  key={player.id}
                  player={player}
                  isSelected={selectedPlayerId === player.id}
                  onSelect={(id) => {
                    if (!isDrawing) setSelectedPlayerId(id);
                  }}
                />
              ))}
            </Field>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App

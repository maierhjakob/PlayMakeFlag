import { useState, useEffect, useRef } from 'react'
import { Field } from '@/components/Field'
import { PlaybookSidebar } from '@/components/PlaybookSidebar'
import { PlaybookGrid } from '@/components/PlaybookGrid'
import { PlayerToken } from '@/components/PlayerToken'
import { RoutePath } from '@/components/RoutePath'
import { PrintModal, type PrintSettings } from '@/components/PrintModal'
import { PrintView } from '@/components/PrintView'
import type { Point, RouteType, RouteSegment } from '@/types'
import { usePlaybook } from '@/hooks/usePlaybook'
import { S, clampPoint } from '@/lib/constants'

function App() {
  const {
    // Playbooks
    playbooks,
    currentPlaybookId,
    setCurrentPlaybookId,
    handleNewPlaybook,
    handleDeletePlaybook,
    handleRenamePlaybook,
    // Plays
    plays,
    currentPlaybook,
    currentPlay,
    currentPlayId,
    setCurrentPlayId,
    selectedPlayer,
    selectedPlayerId,
    setSelectedPlayerId,
    isSettingMotion,
    setIsSettingMotion,
    handleNewPlay,
    handleDeletePlay,
    handleCopyPlay,
    handleUpdatePlayName,
    handleUpdatePlayTags,
    handleUpdatePlayer,
    handleSetPosition,
    handleFormation,
    handleApplyRoute,
    clearRoutes,
    handleMotionSet,
    handleClearMotion,
    handleImportPlaybook,
    updateCurrentPlay,
    calculateRouteStart,
    // Grid
    columnNames,
    handleUpdateColumnName,
    handleAssignPlayToCell,
    handleRemovePlayFromCell,
    handleImportData,
  } = usePlaybook();

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeRouteType, setActiveRouteType] = useState<RouteType>('primary');
  const [drawingType, setDrawingType] = useState<RouteType>('primary');
  const [activeRoutePoints, setActiveRoutePoints] = useState<Point[]>([]);

  // Draggable point state
  const [draggedPoint, setDraggedPoint] = useState<{
    playerId: string;
    routeId: string;
    pointIndex: number;
  } | null>(null);
  const wasDraggingRef = useRef(false);
  const lastHandledHashRef = useRef<string | null>(null);

  const snapToGrid = (p: Point): Point => {
    const snap = S / 2;
    return {
      x: Math.round(p.x / snap) * snap,
      y: Math.round(p.y / snap) * snap
    };
  };

  // Print state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({ playsPerPage: 4 });

  const handlePrint = (settings: PrintSettings) => {
    setPrintSettings(settings);
    setIsPrintModalOpen(false);
    // Delay print to allow the modal to close and PrintView to update
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const startDrawing = () => {
    if (!selectedPlayer) return;
    setDrawingType(activeRouteType);
    setIsDrawing(true);
    // Start from motion end if exists, else position
    const startPos = calculateRouteStart(selectedPlayer);
    setActiveRoutePoints([startPos]);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setActiveRoutePoints([]);
    setIsSettingMotion(false);
  };

  const addToRoute = (point: Point) => {
    if (!isDrawing) return;
    setActiveRoutePoints([...activeRoutePoints, clampPoint(point)]);
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
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    if (!isDrawing) {
      if (selectedPlayerId) setSelectedPlayerId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Snap to 0.5 yards (S is pixels per yard)
    const snap = S / 2;
    const snappedX = Math.round(x / snap) * snap;
    const snappedY = Math.round(y / snap) * snap;

    addToRoute({ x: snappedX, y: snappedY });
  };

  const handleExportPlaybook = async () => {
    try {
      const data = JSON.stringify(currentPlaybook);

      // Use native CompressionStream to shorten the URL
      const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
      const compressedResponse = new Response(stream);
      const compressedBuffer = await compressedResponse.arrayBuffer();

      // Convert buffer to base64
      const binary = String.fromCharCode(...new Uint8Array(compressedBuffer));
      const base64 = btoa(binary);

      const shareUrl = `${window.location.origin}${window.location.pathname}#share=${base64}`;

      navigator.clipboard.writeText(shareUrl).then(() => {
        alert("Compressed share link copied to clipboard!");
      }).catch(err => {
        console.error('Failed to copy link: ', err);
        prompt("Copy this link to share:", shareUrl);
      });
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to generate shareable link.");
    }
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
  }, [isDrawing, activeRoutePoints, setSelectedPlayerId]);

  // Handle shareable links on mount
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#share=')) {
        // Prevent double prompts (especially in development / strict mode or due to dependency changes)
        if (lastHandledHashRef.current === hash) return;
        lastHandledHashRef.current = hash;

        const base64 = hash.replace('#share=', '');
        try {
          // Decode base64 to bytes
          const binary = atob(base64);
          const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

          // Decompress using native DecompressionStream
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
          const decompressedResponse = new Response(stream);
          const jsonString = await decompressedResponse.text();

          if (window.confirm("A playbook has been shared with you. Would you like to import it?")) {
            const success = handleImportData(jsonString);
            if (success) {
              // Clear the hash without reloading and reset the ref
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
              lastHandledHashRef.current = null;
            }
          } else {
            // If they cancel, still don't prompt again for THIS hash until it changes
            // Note: Clear logic might be needed if they want to import LATER, 
            // but usually a click is needed to re-trigger.
          }
        } catch (e) {
          console.error("Failed to decode shared playbook", e);
          alert("The shared link is invalid, corrupted, or used an older version.");
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [handleImportData]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedPoint || !currentPlay) return;

    wasDraggingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const snapped = snapToGrid({ x, y });

    const updatedPlayers = currentPlay.players.map(p => {
      if (p.id !== draggedPoint.playerId) return p;
      return {
        ...p,
        routes: p.routes.map(r => {
          if (r.id !== draggedPoint.routeId) return r;
          const newPoints = [...r.points];
          newPoints[draggedPoint.pointIndex] = clampPoint(snapped);
          return { ...r, points: newPoints };
        })
      };
    });

    updateCurrentPlay({ ...currentPlay, players: updatedPlayers });
  };

  const handleMouseUp = () => {
    setDraggedPoint(null);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
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
          onDeletePlay={handleDeletePlay}
          onUpdatePlayName={handleUpdatePlayName}
          onUpdatePlayTags={handleUpdatePlayTags}
          onStartDrawing={startDrawing}
          onClearRoutes={clearRoutes}
          onUpdatePlayer={handleUpdatePlayer}
          onSetFormation={handleFormation}
          onApplyRoute={(preset) => handleApplyRoute(preset, activeRouteType)}
          onSetPosition={handleSetPosition}
          onExportPlaybook={handleExportPlaybook}
          onImportPlaybook={handleImportPlaybook}
          onCopyPlay={handleCopyPlay}
          activeRouteType={activeRouteType}
          onSetActiveRouteType={setActiveRouteType}
          isDrawing={isDrawing}
          onFinishDrawing={finishDrawing}
          // Motion props
          isSettingMotion={isSettingMotion}
          onSetMotionMode={() => setIsSettingMotion(!isSettingMotion)}
          onClearMotion={handleClearMotion}
        />

        {/* Center - Field */}
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto">
          <div className="p-8 flex items-start gap-4">
            <div className="relative">
              <Field
                onClick={handleFieldClick}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={isDrawing ? 'cursor-crosshair' : isSettingMotion ? 'cursor-alias' : 'cursor-default'}
                showRaster={isDrawing || isSettingMotion || !!draggedPoint}
              >
                {/* Render Routes */}
                <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height="100%">
                  {/* ... (Motion and Routes rendering) */}
                  {currentPlay?.players.map(player => {
                    if (!player.motion) return null;
                    const start = player.position;
                    const end = player.motion;
                    const points = [
                      `${start.x},${start.y}`,
                      `${start.x},${end.y}`,
                      `${end.x},${end.y}`
                    ].join(' ');

                    return (
                      <polyline
                        key={`motion-${player.id}`}
                        points={points}
                        stroke={player.color}
                        strokeWidth={4}
                        strokeOpacity={0.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}

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
                  {isDrawing && activeRoutePoints.length > 0 && (
                    <RoutePath
                      segment={{ id: 'drawing', type: drawingType, points: activeRoutePoints }}
                      color={selectedPlayer?.color || '#000'}
                      isSelected={true}
                    />
                  )}
                </svg>

                {selectedPlayer && !isDrawing && (
                  <svg className="absolute inset-0 pointer-events-none z-20" width="100%" height="100%">
                    {selectedPlayer.routes.map(route => (
                      route.points.map((point, idx) => (
                        <circle
                          key={`${route.id}-${idx}`}
                          cx={point.x}
                          cy={point.y}
                          r={6}
                          fill="white"
                          stroke={selectedPlayer.color}
                          strokeWidth={2}
                          className="pointer-events-auto cursor-move hover:r-8 transition-all"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggedPoint({
                              playerId: selectedPlayer.id,
                              routeId: route.id,
                              pointIndex: idx
                            });
                          }}
                        />
                      ))
                    ))}
                  </svg>
                )}

                {currentPlay?.players.map(player => (
                  <PlayerToken
                    key={player.id}
                    player={player}
                    isSelected={selectedPlayerId === player.id}
                    onSelect={(id) => {
                      if (isSettingMotion) {
                        handleMotionSet(id);
                      } else if (!isDrawing) {
                        setSelectedPlayerId(id);
                      }
                    }}
                  />
                ))}
              </Field>
            </div>

            {/* Play Tags Panel (Right side of Field) */}
            {currentPlay?.tags && currentPlay.tags.length > 0 && (
              <div className="flex flex-col gap-2 pt-1 border-l-2 border-slate-700/50 pl-4 py-2">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Tags</div>
                {currentPlay.tags.map(tag => (
                  <div
                    key={tag.id}
                    className="w-10 h-10 rounded shadow-lg flex items-center justify-center text-lg font-black text-white border border-white/20"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Playbook Grid */}
        <PlaybookGrid
          playbooks={playbooks}
          currentPlaybookId={currentPlaybookId}
          onSelectPlaybook={setCurrentPlaybookId}
          onNewPlaybook={handleNewPlaybook}
          onRenamePlaybook={handleRenamePlaybook}
          onDeletePlaybook={handleDeletePlaybook}
          plays={plays}
          currentPlayId={currentPlayId}
          columnNames={columnNames}
          onUpdateColumnName={handleUpdateColumnName}
          onAssignPlayToCell={handleAssignPlayToCell}
          onRemovePlayFromCell={handleRemovePlayFromCell}
          onSelectPlay={(id) => {
            setCurrentPlayId(id);
            setSelectedPlayerId(null);
            cancelDrawing();
          }}
          onOpenPrintSettings={() => setIsPrintModalOpen(true)}
        />
      </main>

      {/* Modals & Print Layers */}
      <PrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        onPrint={handlePrint}
      />

      {currentPlaybook && (
        <PrintView
          playbook={currentPlaybook}
          playsPerPage={printSettings.playsPerPage}
        />
      )}
    </div>
  )
}

export default App

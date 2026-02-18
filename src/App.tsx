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
import {
  minifyPlaybook,
  unminifyPlaybook,
  isMinified,
  generateRedirectHtml,
  toBase64URL,
  fromBase64URL
} from '@/lib/shareUtils'

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
      if (!currentPlaybook) return;

      // 1. Minify and Compress
      const minified = minifyPlaybook(currentPlaybook);
      const data = JSON.stringify(minified);
      const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
      const compressedResponse = new Response(stream);
      const compressedBuffer = await compressedResponse.arrayBuffer();

      // 2. Base64 Encoding
      const binary = String.fromCharCode(...new Uint8Array(compressedBuffer));
      const base64url = toBase64URL(binary);

      // 3. Generate Redirect HTML
      const htmlContent = generateRedirectHtml(currentPlaybook.name, base64url);
      const file = new File([htmlContent], `${currentPlaybook.name.replace(/\s+/g, '_')}_Share.html`, {
        type: 'text/html'
      });

      // 4. Share File
      if (navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: `Playbook: ${currentPlaybook.name}`,
            text: `Open the attached file to view the playbook: ${currentPlaybook.name}`
          });
          return;
        } catch (e) {
          // Fallback to download if share is cancelled or fails
        }
      }

      // 5. Fallback: Direct Download
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      alert("File downloaded! Share this file with your coach/players.");
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to generate sharing file.");
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

  // Handle shareable links and handshakes on mount
  useEffect(() => {
    // 1. Handshake logic: Tell the opener we are ready (and keep telling them until we get data)
    let handshakeInterval: any;
    if (window.opener) {
      console.log("Handshake: Signaling opener...");
      handshakeInterval = setInterval(() => {
        window.opener.postMessage("HANDSHAKE_READY", "*");
      }, 500);

      // Timeout after 10 seconds to stop pinging
      setTimeout(() => clearInterval(handshakeInterval), 10000);
    }

    const processData = async (shareData: string) => {
      try {
        console.log("Processing share data...");
        // Clear interval if we got data
        if (handshakeInterval) clearInterval(handshakeInterval);
        // Decode URL-safe or standard
        const decoded = decodeURIComponent(shareData);
        const binary = (decoded.includes('-') || decoded.includes('_')) ? fromBase64URL(decoded) : atob(decoded);
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
        const decompressedResponse = new Response(stream);
        const jsonString = await decompressedResponse.text();
        const parsedData = JSON.parse(jsonString);

        const playbookToImport = isMinified(parsedData) ? unminifyPlaybook(parsedData) : parsedData;

        if (window.confirm("A playbook has been shared with you. Would you like to import it?")) {
          const success = handleImportData(JSON.stringify(playbookToImport));
          if (success) {
            window.history.replaceState(null, '', window.location.pathname);
            lastHandledHashRef.current = null;
          }
        }
      } catch (e) {
        console.error("Failed to decode shared playbook", e);
        alert("The shared data is invalid or corrupted.");
      }
    };

    const handleInboundShare = async () => {
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);
      let shareData = searchParams.get('share') || (hash.startsWith('#share=') ? hash.replace('#share=', '') : null);

      if (shareData) {
        // Prevent double prompts
        const currentId = shareData.substring(0, 30);
        if (lastHandledHashRef.current === currentId) return;
        lastHandledHashRef.current = currentId;
        await processData(shareData);
      }
    };

    const handleMessage = async (event: MessageEvent) => {
      // Security: Only handle messages from trusted sources or local files
      if (event.data?.type === "IMPORT_PLAYBOOK" && event.data?.data) {
        await processData(event.data.data);
      }
    };

    handleInboundShare();
    window.addEventListener('hashchange', handleInboundShare);
    window.addEventListener('popstate', handleInboundShare);
    window.addEventListener('message', handleMessage);

    return () => {
      if (handshakeInterval) clearInterval(handshakeInterval);
      window.removeEventListener('hashchange', handleInboundShare);
      window.removeEventListener('popstate', handleInboundShare);
      window.removeEventListener('message', handleMessage);
    };
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
          onDeletePlay={handleDeletePlay}
          onUpdatePlayName={handleUpdatePlayName}
          onUpdatePlayTags={handleUpdatePlayTags}
          onStartDrawing={startDrawing}
          onClearRoutes={clearRoutes}
          onUpdatePlayer={handleUpdatePlayer}
          onSetFormation={handleFormation}
          onApplyRoute={(preset) => handleApplyRoute(preset, activeRouteType)}
          onSetPosition={handleSetPosition}
          onSetMotionMode={() => setIsSettingMotion(!isSettingMotion)}
          onExportPlaybook={handleExportPlaybook}
          onCopyPlay={handleCopyPlay}
          activeRouteType={activeRouteType}
          onSetActiveRouteType={setActiveRouteType}
          isDrawing={isDrawing}
          onFinishDrawing={finishDrawing}
          // Motion props
          isSettingMotion={isSettingMotion}
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

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
    handleMirrorPlay,
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
    pushToUndoStack,
    undo,
    redo,
    // Grid
    columnNames,
    handleUpdateColumnName,
    handleAddColumn,
    handleRemoveColumn,
    handleAssignPlayToCell,
    handleRemovePlayFromCell,
    handleImportData,
    // Folders
    folders,
    handleCreateFolder,
    handleDeleteFolder,
    handleRenameFolder,
    handleToggleFolder,
    handleAssignPlayToFolder,
    handleReorderPlayInFolder,
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
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
  const wasDraggingRef = useRef(false);
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    pushToUndoStack();
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
      const minified = minifyPlaybook(currentPlaybook, plays);
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      // Arrow keys navigate between plays — skip when typing in an input
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();

        const topFoldersSorted = [...folders]
          .filter(f => !f.parentId)
          .sort((a, b) => a.order - b.order);
        const ordered: typeof plays = [];
        for (const folder of topFoldersSorted) {
          ordered.push(...plays.filter(p => p.folderId === folder.id));
          const subs = [...folders]
            .filter(f => f.parentId === folder.id)
            .sort((a, b) => a.order - b.order);
          for (const sub of subs) ordered.push(...plays.filter(p => p.folderId === sub.id));
        }
        ordered.push(...plays.filter(p => !p.folderId));

        const idx = ordered.findIndex(p => p.id === currentPlayId);
        const target = e.key === 'ArrowUp'
          ? (idx > 0 ? ordered[idx - 1] : null)
          : (idx < ordered.length - 1 ? ordered[idx + 1] : null);
        if (target) {
          setCurrentPlayId(target.id);
          setSelectedPlayerId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, activeRoutePoints, setSelectedPlayerId, undo, redo, plays, folders, currentPlayId, setCurrentPlayId]);

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
    if (!draggedPoint && !draggedPlayer) return;
    if (!currentPlay) return;

    wasDraggingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const snapped = snapToGrid({ x, y });

    if (draggedPoint) {
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
    } else if (draggedPlayer) {
      handleUpdatePlayer(draggedPlayer, { position: clampPoint(snapped) });
    }
  };

  const handleMouseUp = () => {
    setDraggedPoint(null);
    setDraggedPlayer(null);
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
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
          onMirrorPlay={handleMirrorPlay}
          activeRouteType={activeRouteType}
          onSetActiveRouteType={setActiveRouteType}
          isDrawing={isDrawing}
          onFinishDrawing={finishDrawing}
          // Motion props
          isSettingMotion={isSettingMotion}
          onClearMotion={handleClearMotion}
          folders={folders}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onRenameFolder={handleRenameFolder}
          onToggleFolder={handleToggleFolder}
          onAssignPlayToFolder={handleAssignPlayToFolder}
          onReorderPlayInFolder={handleReorderPlayInFolder}
        />

        {/* Center - Field */}
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto">
          <div className="p-8 flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              {/* Tags above the field */}
              {currentPlay?.tags && currentPlay.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap justify-center w-full">
                  {currentPlay.tags.map(tag => (
                    <div
                      key={tag.id}
                      className="px-3 py-1 rounded-full text-sm font-black text-white shadow-lg"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.text}
                    </div>
                  ))}
                </div>
              )}
              <div className="relative">
                <Field
                  onClick={handleFieldClick}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className={isDrawing ? 'cursor-crosshair' : isSettingMotion ? 'cursor-alias' : 'cursor-default'}
                  showRaster={isDrawing || isSettingMotion || !!draggedPoint || !!draggedPlayer}
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
                              pushToUndoStack();
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
                      isDragging={draggedPlayer === player.id}
                      onSelect={(id) => {
                        if (isSettingMotion) {
                          handleMotionSet(id);
                        } else if (!isDrawing) {
                          setSelectedPlayerId(id);
                        }
                      }}
                      onDragStart={(id) => {
                        if (!isDrawing && !isSettingMotion) {
                          dragTimerRef.current = setTimeout(() => {
                            pushToUndoStack();
                            setDraggedPlayer(id);
                            dragTimerRef.current = null;
                          }, 300);
                        }
                      }}
                    />
                  ))}
                </Field>
              </div>
            </div>

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
          onAddColumn={handleAddColumn}
          onRemoveColumn={handleRemoveColumn}
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
          plays={plays}
          playsPerPage={printSettings.playsPerPage}
        />
      )}
    </div>
  )
}

export default App

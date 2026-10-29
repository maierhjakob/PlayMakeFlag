import { useState, useEffect, useRef } from 'react'
import { Field } from '@/components/Field'
import { PlaybookSidebar } from '@/components/PlaybookSidebar'
import { PlaybookGrid } from '@/components/PlaybookGrid'
import { PlayerToken } from '@/components/PlayerToken'
import { RoutePath } from '@/components/RoutePath'
import { RouteControls } from '@/components/RouteControls'
import { DefenseControls } from '@/components/DefenseControls'
import { DefenseLayer } from '@/components/DefenseLayer'
import { DefenderToken } from '@/components/DefenderToken'
import { PrintModal, type PrintSettings } from '@/components/PrintModal'
import { ShareModal } from '@/components/ShareModal'
import { CommentModal } from '@/components/CommentModal'
import { MergeModal } from '@/components/MergeModal'
import { PrintView } from '@/components/PrintView'
import type { Point, RouteType, RouteSegment, Coverage, Defender, Playbook } from '@/types'
import { usePlaybook } from '@/hooks/usePlaybook'
import { S, clampPoint } from '@/lib/constants'
import { applyCoverage, completeDefense, defenderColor, DEFENDER_COUNT, NEUTRAL_OFFENSE_COLOR } from '@/lib/defense'
import { cn } from '@/lib/utils'
import {
  minifyPlaybook,
  unminifyPlaybook,
  isMinified,
  minifyBackup,
  unminifyBackup,
  isBackup,
  encodeShareData,
  formatSavedAt,
  fileStampSavedAt,
  generateRedirectHtml,
  extractShareData,
  fromBase64URL
} from '@/lib/shareUtils'
import { Capacitor } from '@capacitor/core'
import { ImageDown, MessageSquare, Shield } from 'lucide-react'
import { App as NativeApp } from '@capacitor/app'
import { saveFile, shareFile } from '@/lib/shareFile'
import { renderPlayImage } from '@/lib/playImage'
import { canPickBackupLocation, getBackupLocation, pickBackupLocation, writeBackup } from '@/lib/backupLocation'

const FIELD_PX = 625;
// Padding around the field column in the center pane on desktop (md:p-8)
const CENTER_PANE_PADDING = 32;
// Below this the field gets too small to draw on; the pane scrolls instead
const MIN_DESKTOP_FIELD_SCALE = 0.6;

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
    handleUpdatePlayComment,
    handleUpdatePlayer,
    handleMovePlayerLayer,
    handleUpdateDefense,
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
    importConflicts,
    resolveImportConflicts,
    // Saved routes
    savedRoutes,
    handleSaveRoute,
    handleDeleteSavedRoute,
    handleApplySavedRoute,
    // Folders
    folders,
    handleToggleFolder,
    handleReorderPlay,
  } = usePlaybook();

  // Mobile layout state
  const [mobileTab, setMobileTab] = useState<'plays' | 'field' | 'grid'>('field');
  const [fieldScale, setFieldScale] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const fieldContainerRef = useRef<HTMLDivElement>(null);

  // Resizable sidebar widths (desktop only)
  const [leftWidth, setLeftWidth] = useState(() => Number(localStorage.getItem('pmf_leftWidth')) || 288);
  const [rightWidth, setRightWidth] = useState(() => Number(localStorage.getItem('pmf_rightWidth')) || 490);
  const resizingRef = useRef<'left' | 'right' | null>(null);

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

  // Defense view: field turned by 180°, defenders editable instead of the offense
  const [isDefenseView, setIsDefenseView] = useState(false);
  const [selectedDefenderId, setSelectedDefenderId] = useState<string | null>(null);
  const [draggedDefender, setDraggedDefender] = useState<string | null>(null);
  // Zone handles of the selected defender: move the zone or change its size
  const [draggedZoneHandle, setDraggedZoneHandle] = useState<'move' | 'size' | null>(null);
  // While moving a zone: zone center minus the grab point, so the zone doesn't jump to the pointer
  const zoneGrabOffsetRef = useRef<Point | null>(null);
  // Drawing an arrow for the selected defender (null when not drawing)
  const [defenderArrowPoints, setDefenderArrowPoints] = useState<Point[] | null>(null);
  // Index of the selected defender's arrow point being dragged
  const [draggedArrowPoint, setDraggedArrowPoint] = useState<number | null>(null);
  // Set when a press starts on a route handle; the click that follows may land on the field
  // (the handle is replaced by a new point under the cursor) and must not deselect the player
  const pressedHandleRef = useRef(false);
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandledHashRef = useRef<string | null>(null);

  const snapToGrid = (p: Point): Point => {
    const snap = S / 2;
    return {
      x: Math.round(p.x / snap) * snap,
      y: Math.round(p.y / snap) * snap
    };
  };

  /** Screen position → field coordinates, taking the scale and the defense view's 180° turn into account */
  const toFieldPoint = (clientX: number, clientY: number, fieldEl: Element): Point => {
    const rect = fieldEl.getBoundingClientRect();
    const x = (clientX - rect.left) / fieldScale;
    const y = (clientY - rect.top) / fieldScale;
    return isDefenseView ? { x: FIELD_PX - x, y: FIELD_PX - y } : { x, y };
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

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 768) {
        setFieldScale(Math.min(1, window.innerWidth / 641));
        setIsMobile(true);
      } else {
        setIsMobile(false);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Desktop: shrink the field so it fits next to the route controls without scrolling
  const centerPaneRef = useRef<HTMLDivElement>(null);
  const fieldColumnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isMobile) return;
    const pane = centerPaneRef.current;
    const column = fieldColumnRef.current;
    if (!pane || !column) return;
    const fit = () => {
      setFieldScale(scale => {
        // Height of everything in the column except the field itself, plus the pane padding
        const otherHeight = column.offsetHeight - FIELD_PX * scale + 2 * CENTER_PANE_PADDING;
        const fitted = Math.min(
          1,
          (pane.clientHeight - otherHeight) / FIELD_PX,
          (pane.clientWidth - 2 * CENTER_PANE_PADDING) / FIELD_PX
        );
        const next = Math.max(MIN_DESKTOP_FIELD_SCALE, Math.floor(fitted * 100) / 100);
        return Math.abs(next - scale) >= 0.01 ? next : scale;
      });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(pane);
    observer.observe(column);
    return () => observer.disconnect();
  }, [isMobile]);

  // Sidebar resize drag handling
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      if (resizingRef.current === 'left') {
        setLeftWidth(Math.min(600, Math.max(200, e.clientX)));
      } else {
        setRightWidth(Math.min(700, Math.max(200, window.innerWidth - e.clientX)));
      }
    };
    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => { localStorage.setItem('pmf_leftWidth', String(leftWidth)); }, [leftWidth]);
  useEffect(() => { localStorage.setItem('pmf_rightWidth', String(rightWidth)); }, [rightWidth]);

  const startResize = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = side;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const el = fieldContainerRef.current;
    if (!el) return;
    const preventScroll = (e: TouchEvent) => {
      if (isDrawing || draggedPlayer || draggedPoint || draggedDefender || draggedZoneHandle || draggedArrowPoint !== null) e.preventDefault();
    };
    el.addEventListener('touchmove', preventScroll, { passive: false });
    return () => el.removeEventListener('touchmove', preventScroll);
  }, [isDrawing, draggedPlayer, draggedPoint, draggedDefender, draggedZoneHandle, draggedArrowPoint]);

  const startDrawing = () => {
    if (!selectedPlayer) return;
    setDrawingType(activeRouteType);
    setIsDrawing(true);
    setMobileTab('field');
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
    if (wasDraggingRef.current || pressedHandleRef.current) {
      wasDraggingRef.current = false;
      pressedHandleRef.current = false;
      return;
    }
    if (defenderArrowPoints) {
      const point = clampPoint(snapToGrid(toFieldPoint(e.clientX, e.clientY, e.currentTarget)));
      setDefenderArrowPoints([...defenderArrowPoints, point]);
      return;
    }
    if (!isDrawing) {
      if (selectedPlayerId) setSelectedPlayerId(null);
      if (selectedDefenderId) setSelectedDefenderId(null);
      return;
    }
    const { x, y } = toFieldPoint(e.clientX, e.clientY, e.currentTarget);

    // Snap to 0.5 yards (S is pixels per yard)
    const snap = S / 2;
    const snappedX = Math.round(x / snap) * snap;
    const snappedY = Math.round(y / snap) * snap;

    addToRoute({ x: snappedX, y: snappedY });
  };

  // Ignore clicks while an image is being made: the first one takes a moment and invites a second click
  const isExportingImageRef = useRef(false);
  const handleExportPlayImage = async () => {
    if (!currentPlay || isExportingImageRef.current) return;
    isExportingImageRef.current = true;
    try {
      const file = await renderPlayImage(currentPlay, { showDefense: isDefenseView });
      // No text with the image: share targets would get it as a second item (the name is in the image anyway)
      await shareFile(file, { title: `Play: ${currentPlay.name}` });
    } catch (e) {
      console.error("Image export failed", e);
      alert("Failed to create the play image.");
    } finally {
      isExportingImageRef.current = false;
    }
  };

  // Bundle a playbook into the standalone .html file that opens it in the app
  const createPlaybookFile = async (playbook: Playbook) => {
    // `plays` carries the current playbook's grid positions; use this playbook's own
    const playbookPlays = plays.map(p => ({ ...p, gridPosition: playbook.entries.find(e => e.playId === p.id)?.gridPosition }));
    const base64url = await encodeShareData(minifyPlaybook(playbook, playbookPlays));
    const htmlContent = generateRedirectHtml(playbook.name, base64url);
    return new File([htmlContent], `${playbook.name.replace(/\s+/g, '_')}_Share.html`, { type: 'text/html' });
  };

  // Bundle several playbooks into one file, in the backup format
  const createPlaybooksFile = async (selected: Playbook[], title: string, fileName: string, savedAt: number) => {
    const base64url = await encodeShareData(minifyBackup(selected, plays, savedAt));
    return new File([generateRedirectHtml(title, base64url)], fileName, { type: 'text/html' });
  };

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);

  const handleExportPlaybooks = async (playbookIds: string[]) => {
    setIsShareModalOpen(false);
    const selected = playbooks.filter(pb => playbookIds.includes(pb.id));
    if (selected.length === 0) return;
    try {
      const savedAt = Date.now();
      const name = selected.length === 1 ? selected[0].name : `${selected.length} playbooks`;
      const file = selected.length === 1
        ? await createPlaybookFile(selected[0])
        : await createPlaybooksFile(selected, `${name} (saved ${formatSavedAt(savedAt)})`, `Playbooks_${fileStampSavedAt(savedAt)}_Share.html`, savedAt);

      // Share the file, or download it where sharing isn't available
      const result = await shareFile(file, {
        title: `Playbook: ${name}`,
        text: `Open the attached file to view the playbook: ${selected.map(pb => pb.name).join(', ')}`,
      });
      if (result === 'downloaded') alert("File downloaded! Share this file with your coach/players.");
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to generate sharing file.");
    }
  };

  const [lastBackupAt, setLastBackupAt] = useState<number | null>(() => Number(localStorage.getItem('lastBackupAt')) || null);

  // The file backups overwrite, where the browser lets you pick one (Chrome / Edge on desktop)
  const [backupFileName, setBackupFileName] = useState<string | null>(() => localStorage.getItem('backupFileName'));

  const handleBackupAll = async (changeLocation = false) => {
    try {
      // Pick or unlock the backup file first: the picker and the permission prompt need the click
      const handle = canPickBackupLocation
        ? await (changeLocation || !backupFileName ? pickBackupLocation() : getBackupLocation())
        : null;
      if (canPickBackupLocation && !handle) return; // Cancelled

      const savedAt = Date.now();
      const file = await createPlaybooksFile(playbooks, `All playbooks (saved ${formatSavedAt(savedAt)})`, `PlayMakerFlag_Backup_${fileStampSavedAt(savedAt)}.html`, savedAt);
      let location: string;
      if (handle) {
        await writeBackup(handle, file);
        localStorage.setItem('backupFileName', handle.name);
        setBackupFileName(handle.name);
        location = `"${handle.name}"`;
      } else {
        location = await saveFile(file);
      }
      localStorage.setItem('lastBackupAt', String(savedAt));
      setLastBackupAt(savedAt);
      alert(`Backup of ${playbooks.length} playbook(s) saved to ${location}. Open the file to restore it.`);
    } catch (e) {
      // The remembered file was moved or deleted
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        localStorage.removeItem('backupFileName');
        setBackupFileName(null);
        alert("The backup file was moved or deleted. Click the backup button again to choose where to save it.");
        return;
      }
      console.error("Backup failed", e);
      alert("Failed to save the backup file.");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isDrawing) finishDrawing();
      if (e.key === 'Enter' && defenderArrowPoints) finishDefenderArrow();
      if (e.key === 'Escape') {
        if (isDrawing) cancelDrawing();
        else if (defenderArrowPoints) setDefenderArrowPoints(null);
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
  }, [isDrawing, activeRoutePoints, defenderArrowPoints, selectedDefenderId, setSelectedPlayerId, undo, redo, plays, folders, currentPlayId, setCurrentPlayId]);

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

        let toImport, question;
        if (isBackup(parsedData)) {
          const backup = unminifyBackup(parsedData);
          toImport = backup.playbooks;
          question = `This file contains ${backup.playbooks.length} playbook(s), saved ${formatSavedAt(backup.savedAt)}. Would you like to import them? They are added next to your current playbooks.`;
        } else {
          toImport = isMinified(parsedData) ? unminifyPlaybook(parsedData) : parsedData;
          question = "A playbook has been shared with you. Would you like to import it?";
        }

        if (window.confirm(question)) {
          const success = handleImportData(JSON.stringify(toImport));
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

    // Native app: an exported playbook .html file was opened with the app (content:// or file:// URL)
    const handleOpenedFile = async (url: string | undefined) => {
      if (!url || !/^(content|file):/.test(url)) return;
      try {
        const html = await (await fetch(Capacitor.convertFileSrc(url))).text();
        const shareData = extractShareData(html);
        if (!shareData) {
          alert("This file doesn't contain a playbook.");
          return;
        }
        await processData(shareData);
      } catch (e) {
        console.error("Failed to open playbook file", e);
        alert("The file could not be opened.");
      }
    };
    const urlOpenListener = Capacitor.isNativePlatform()
      ? NativeApp.addListener('appUrlOpen', ({ url }) => handleOpenedFile(url))
      : null;
    if (Capacitor.isNativePlatform()) {
      NativeApp.getLaunchUrl().then(launch => handleOpenedFile(launch?.url));
    }

    handleInboundShare();
    window.addEventListener('hashchange', handleInboundShare);
    window.addEventListener('popstate', handleInboundShare);
    window.addEventListener('message', handleMessage);

    return () => {
      urlOpenListener?.then(listener => listener.remove());
      if (handshakeInterval) clearInterval(handshakeInterval);
      window.removeEventListener('hashchange', handleInboundShare);
      window.removeEventListener('popstate', handleInboundShare);
      window.removeEventListener('message', handleMessage);
    };
  }, [handleImportData]);

  // Drag a defender, or the selected defender's zone, to a (snapped) field point
  const dragDefenseTo = (point: Point) => {
    if (!currentPlay?.defense) return;
    const defenders = currentPlay.defense.defenders.map(d => {
      if (draggedDefender === d.id) {
        // The arrow moves along with the defender
        const position = clampPoint(point);
        const dx = position.x - d.position.x;
        const dy = position.y - d.position.y;
        return { ...d, position, path: d.path?.map(p => clampPoint({ x: p.x + dx, y: p.y + dy })) };
      }
      if (draggedArrowPoint !== null && selectedDefenderId === d.id && d.path) {
        return { ...d, path: d.path.map((p, i) => i === draggedArrowPoint ? clampPoint(point) : p), pathFromCoverage: false };
      }
      if (draggedZoneHandle && selectedDefenderId === d.id && d.zone) {
        return {
          ...d,
          zone: draggedZoneHandle === 'move'
            ? (() => {
              const offset = zoneGrabOffsetRef.current ?? { x: 0, y: 0 };
              return { ...d.zone, dx: point.x + offset.x - d.position.x, dy: point.y + offset.y - d.position.y };
            })()
            : {
              ...d.zone,
              rx: Math.max(S, Math.abs(point.x - (d.position.x + d.zone.dx))),
              ry: Math.max(S, Math.abs(point.y - (d.position.y + d.zone.dy))),
            },
        };
      }
      return d;
    });
    handleUpdateDefense({ ...currentPlay.defense, defenders });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedPoint && !draggedPlayer && !draggedDefender && !draggedZoneHandle && draggedArrowPoint === null) return;
    if (!currentPlay) return;

    const snapped = snapToGrid(toFieldPoint(e.clientX, e.clientY, e.currentTarget));

    // Defender / zone drags end on the dragged element itself, so no field click needs swallowing
    if (draggedDefender || draggedZoneHandle || draggedArrowPoint !== null) {
      dragDefenseTo(snapped);
      return;
    }
    wasDraggingRef.current = true;

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

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedPoint && !draggedPlayer && !draggedDefender && !draggedZoneHandle && draggedArrowPoint === null) return;
    if (!currentPlay) return;

    const touch = e.touches[0];
    const snapped = snapToGrid(toFieldPoint(touch.clientX, touch.clientY, e.currentTarget));

    if (draggedDefender || draggedZoneHandle || draggedArrowPoint !== null) {
      dragDefenseTo(snapped);
      return;
    }
    wasDraggingRef.current = true;

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

  // Insert a new point into a route (splitting a segment or extending the end) and start dragging it
  const startInsertPoint = (routeId: string, insertIndex: number, point: Point) => {
    if (!selectedPlayer || !currentPlay) return;
    pushToUndoStack();
    const updatedPlayers = currentPlay.players.map(p => {
      if (p.id !== selectedPlayer.id) return p;
      return {
        ...p,
        routes: p.routes.map(r => {
          if (r.id !== routeId) return r;
          const newPoints = [...r.points];
          newPoints.splice(insertIndex, 0, clampPoint(snapToGrid(point)));
          return { ...r, points: newPoints };
        })
      };
    });
    updateCurrentPlay({ ...currentPlay, players: updatedPlayers });
    setDraggedPoint({ playerId: selectedPlayer.id, routeId, pointIndex: insertIndex });
  };

  // Remove the last line of a route (its end point), keeping at least one line
  const removeLastLine = (routeId: string) => {
    if (!selectedPlayer || !currentPlay) return;
    pushToUndoStack();
    const updatedPlayers = currentPlay.players.map(p => {
      if (p.id !== selectedPlayer.id) return p;
      return {
        ...p,
        routes: p.routes.map(r =>
          r.id === routeId && r.points.length > 2 ? { ...r, points: r.points.slice(0, -1) } : r
        )
      };
    });
    updateCurrentPlay({ ...currentPlay, players: updatedPlayers });
  };

  // ============================================
  // DEFENSE
  // ============================================

  const toggleDefenseView = () => {
    cancelDrawing();
    setDefenderArrowPoints(null);
    setSelectedPlayerId(null);
    setSelectedDefenderId(null);
    setIsDefenseView(v => !v);
  };

  // A defender selected in one play means nothing in another
  useEffect(() => { setSelectedDefenderId(null); setDefenderArrowPoints(null); }, [currentPlayId]);

  const updateDefenders = (update: (defenders: Defender[]) => Defender[]) => {
    if (!currentPlay) return;
    pushToUndoStack();
    const defense = currentPlay.defense ?? { coverage: null, defenders: [] };
    handleUpdateDefense({ ...defense, defenders: update(defense.defenders) });
  };

  // The defense view always shows all five defenders: add them when the play doesn't have them yet
  useEffect(() => {
    if (!isDefenseView || !currentPlay) return;
    if ((currentPlay.defense?.defenders.length ?? 0) >= DEFENDER_COUNT) return;
    handleUpdateDefense(completeDefense(currentPlay, currentPlay.defense));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDefenseView, currentPlay?.id, currentPlay?.defense?.defenders.length]);

  const selectCoverage = (coverage: Coverage) => {
    if (!currentPlay) return;
    pushToUndoStack();
    handleUpdateDefense(applyCoverage(currentPlay, completeDefense(currentPlay, currentPlay.defense), coverage));
  };

  const updateDefender = (id: string, updates: Partial<Defender>) =>
    updateDefenders(defenders => defenders.map(d => d.id === id ? { ...d, ...updates } : d));

  const startDefenderArrow = () => setDefenderArrowPoints([]);

  const finishDefenderArrow = () => {
    if (selectedDefenderId && defenderArrowPoints?.length) {
      updateDefender(selectedDefenderId, { path: defenderArrowPoints, pathFromCoverage: false });
    }
    setDefenderArrowPoints(null);
  };


  const handleMouseUp = () => {
    setDraggedPoint(null);
    setDraggedPlayer(null);
    setDraggedDefender(null);
    setDraggedZoneHandle(null);
    setDraggedArrowPoint(null);
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
  };

  return (
    <div
      className="h-dvh flex flex-col bg-slate-950"
      // Edge-to-edge (viewport-fit=cover): keep clear of the status bar and display cutouts
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar */}
        <PlaybookSidebar
          className={cn(mobileTab === 'plays' ? 'flex md:flex' : 'hidden md:flex', 'w-full md:w-auto shrink-0')}
          style={isMobile ? undefined : { width: leftWidth }}
          plays={plays}
          currentPlayId={currentPlayId}
          selectedPlayer={selectedPlayer}
          onSelectPlay={(id) => {
            setCurrentPlayId(id);
            setSelectedPlayerId(null);
            cancelDrawing();
            setMobileTab('field');
          }}
          onNewPlay={handleNewPlay}
          onDeletePlay={handleDeletePlay}
          onUpdatePlayName={handleUpdatePlayName}
          onUpdatePlayTags={handleUpdatePlayTags}
          onUpdatePlayer={handleUpdatePlayer}
          onMovePlayerLayer={handleMovePlayerLayer}
          onSetFormation={handleFormation}
          onSetPosition={handleSetPosition}
          onSetMotionMode={() => { setIsSettingMotion(!isSettingMotion); if (!isSettingMotion) setMobileTab('field'); }}
          onCopyPlay={handleCopyPlay}
          onMirrorPlay={handleMirrorPlay}
          // Motion props
          isSettingMotion={isSettingMotion}
          onClearMotion={handleClearMotion}
          folders={folders}
          onToggleFolder={handleToggleFolder}
          onReorderPlay={handleReorderPlay}
        />

        {/* Left resize handle */}
        <div
          onMouseDown={startResize('left')}
          className="hidden md:block w-1 shrink-0 cursor-col-resize bg-slate-700 hover:bg-blue-500 transition-colors"
        />

        {/* Center - Field */}
        <div ref={centerPaneRef} className={cn("flex-1 flex items-start justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto", mobileTab === 'field' ? 'flex' : 'hidden md:flex')}>
          <div className="w-full my-auto p-4 md:p-8 flex items-start justify-center gap-4">
            <div ref={fieldColumnRef} className="w-full flex flex-col items-center gap-2">
              {/* Tags above the field: always the same height (one line), so the field doesn't jump */}
              <div className="h-8 flex items-center gap-2 justify-center w-full overflow-hidden shrink-0">
                {currentPlay?.tags?.map(tag => (
                  <div
                    key={tag.id}
                    className="px-3 py-1 rounded-full text-sm font-black text-white shadow-lg whitespace-nowrap shrink-0"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.text}
                  </div>
                ))}
              </div>
              {/* Comment above the field: one line of fixed height like the tags, the full text on hover */}
              <div className="h-5 w-full flex justify-center shrink-0">
                {currentPlay?.comment && (
                  <button
                    onClick={() => setIsCommentModalOpen(true)}
                    className="max-w-full truncate text-sm italic text-slate-300 hover:text-emerald-400 transition-colors"
                    title={currentPlay.comment}
                  >
                    {currentPlay.comment.replace(/\s*\n\s*/g, ' · ')}
                  </button>
                )}
              </div>
              <div
                ref={fieldContainerRef}
                className="relative"
                style={{ width: 625 * fieldScale, height: 625 * fieldScale }}
              >
                {/* Defense view toggle: left of the field, inside its corner on phones */}
                {currentPlay && (
                  <button
                    onClick={toggleDefenseView}
                    className={cn(
                      "absolute z-30 top-1 left-1 md:top-0 md:left-auto md:right-full md:mr-2 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border transition-colors",
                      isDefenseView
                        ? "bg-red-700 border-red-500 text-white"
                        : "bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-red-400"
                    )}
                    title={isDefenseView ? 'Back to the offense view' : 'Defense view: see the play from the defense and set up a coverage'}
                  >
                    <Shield size={18} />
                    <span className="text-[10px] font-semibold">DEF</span>
                  </button>
                )}

                {/* Share the play as an image: right of the field, inside its corner on phones */}
                {currentPlay && (
                  <button
                    onClick={handleExportPlayImage}
                    className="absolute z-30 top-1 right-1 md:top-0 md:right-auto md:left-full md:ml-2 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-emerald-400 transition-colors"
                    title="Share this play as an image (PNG)"
                  >
                    <ImageDown size={18} />
                    <span className="text-[10px] font-semibold">PNG</span>
                  </button>
                )}

                {/* Comment on the play, shown in the PNG: below the PNG button */}
                {currentPlay && (
                  <button
                    onClick={() => setIsCommentModalOpen(true)}
                    className={cn(
                      "absolute z-30 top-14 right-1 md:right-auto md:left-full md:ml-2 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border transition-colors",
                      currentPlay.comment
                        ? "bg-emerald-700 border-emerald-500 text-white"
                        : "bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-emerald-400"
                    )}
                    title={currentPlay.comment ? `Comment: ${currentPlay.comment}` : 'Add a comment to this play (shown in the PNG)'}
                  >
                    <MessageSquare size={18} />
                    <span className="text-[10px] font-semibold">NOTE</span>
                  </button>
                )}
                <div style={{ transform: `scale(${fieldScale})`, transformOrigin: 'top left', width: 625, height: 625 }}>
                <div style={{ transform: isDefenseView ? 'rotate(180deg)' : undefined, width: 625, height: 625 }}>
                <Field
                  flipped={isDefenseView}
                  onClick={handleFieldClick}
                  onMouseDown={() => { pressedHandleRef.current = false; }}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                  className={isDrawing || defenderArrowPoints ? 'cursor-crosshair' : isSettingMotion ? 'cursor-alias' : 'cursor-default'}
                  showRaster={isDrawing || isSettingMotion || !!draggedPoint || !!draggedPlayer || !!defenderArrowPoints || !!draggedDefender || !!draggedZoneHandle || draggedArrowPoint !== null}
                >
                  {/* Render Routes */}
                  <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height="100%">
                    {/* Defense (zones, man lines, rush) under the offense's routes */}
                    {isDefenseView && currentPlay?.defense && (
                      <DefenseLayer
                        play={currentPlay}
                        defense={currentPlay.defense}
                        toCanvas={p => p}
                        yard={S}
                        selectedDefenderId={selectedDefenderId}
                      />
                    )}
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
                          stroke={isDefenseView ? NEUTRAL_OFFENSE_COLOR : player.color}
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
                          color={isDefenseView ? NEUTRAL_OFFENSE_COLOR : player.color}
                          isSelected={selectedPlayerId === player.id}
                          onSelect={isDrawing || isSettingMotion || isDefenseView ? undefined : () => {
                            setSelectedPlayerId(player.id);
                            setActiveRouteType(route.type);
                          }}
                        />
                      ))
                    ))}
                    {currentPlay?.players.map(player => (
                      player.routes.filter(r => r.type === 'primary').map(route => (
                        <RoutePath
                          key={route.id}
                          segment={route}
                          color={isDefenseView ? NEUTRAL_OFFENSE_COLOR : player.color}
                          isSelected={selectedPlayerId === player.id}
                          onSelect={isDrawing || isSettingMotion || isDefenseView ? undefined : () => {
                            setSelectedPlayerId(player.id);
                            setActiveRouteType(route.type);
                          }}
                        />
                      ))
                    ))}
                    {defenderArrowPoints && (() => {
                      const index = currentPlay?.defense?.defenders.findIndex(d => d.id === selectedDefenderId) ?? -1;
                      const defender = index >= 0 ? currentPlay!.defense!.defenders[index] : null;
                      if (!defender || defenderArrowPoints.length === 0) return null;
                      return (
                        <RoutePath
                          segment={{ id: 'defender-arrow', type: 'primary', points: [defender.position, ...defenderArrowPoints] }}
                          color={defenderColor(defender, index)}
                        />
                      );
                    })()}
                    {isDrawing && activeRoutePoints.length > 0 && (
                      <RoutePath
                        segment={{ id: 'drawing', type: drawingType, points: activeRoutePoints }}
                        color={selectedPlayer?.color || '#000'}
                        isSelected={true}
                      />
                    )}
                  </svg>

                  {selectedPlayer && !isDrawing && (
                    <svg
                      className="absolute inset-0 pointer-events-none z-20"
                      width="100%"
                      height="100%"
                      onMouseDownCapture={() => { pressedHandleRef.current = true; }}
                      onTouchStartCapture={() => { pressedHandleRef.current = true; }}
                    >
                      {/* Segment midpoints: drag to split a line into two */}
                      {selectedPlayer.routes.map(route => (
                        route.points.slice(1).map((point, idx) => {
                          const prev = route.points[idx];
                          const mid = { x: (prev.x + point.x) / 2, y: (prev.y + point.y) / 2 };
                          return (
                            <circle
                              key={`${route.id}-mid-${idx}`}
                              cx={mid.x}
                              cy={mid.y}
                              r={4}
                              fill={selectedPlayer.color}
                              fillOpacity={0.5}
                              stroke="white"
                              strokeWidth={1.5}
                              className="pointer-events-auto cursor-copy"
                              onMouseDown={(e) => { e.stopPropagation(); startInsertPoint(route.id, idx + 1, mid); }}
                              onTouchStart={(e) => { e.stopPropagation(); startInsertPoint(route.id, idx + 1, mid); }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <title>Drag to add a break</title>
                            </circle>
                          );
                        })
                      ))}

                      {/* Past the arrow tip: drag "+" to add another line at the end, click "-" to remove the last one */}
                      {selectedPlayer.routes.map(route => {
                        if (route.points.length < 2) return null;
                        const last = route.points[route.points.length - 1];
                        const prev = route.points[route.points.length - 2];
                        const len = Math.hypot(last.x - prev.x, last.y - prev.y);
                        if (len === 0) return null;
                        const ext = clampPoint({
                          x: last.x + (last.x - prev.x) / len * S * 1.5,
                          y: last.y + (last.y - prev.y) / len * S * 1.5
                        });
                        if (ext.x === last.x && ext.y === last.y) return null;
                        // "-" sits beside the "+", perpendicular to the last line
                        const remove = {
                          x: ext.x - (last.y - prev.y) / len * 16,
                          y: ext.y + (last.x - prev.x) / len * 16
                        };
                        return (
                          <g key={`${route.id}-ext`}>
                            <g
                              className="pointer-events-auto cursor-copy"
                              onMouseDown={(e) => { e.stopPropagation(); startInsertPoint(route.id, route.points.length, ext); }}
                              onTouchStart={(e) => { e.stopPropagation(); startInsertPoint(route.id, route.points.length, ext); }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <title>Drag to extend the route</title>
                              <circle cx={ext.x} cy={ext.y} r={6} fill="white" stroke={selectedPlayer.color} strokeWidth={1.5} strokeDasharray="2,2" />
                              <path d={`M ${ext.x - 3} ${ext.y} H ${ext.x + 3} M ${ext.x} ${ext.y - 3} V ${ext.y + 3}`} stroke={selectedPlayer.color} strokeWidth={1.5} />
                            </g>
                            {route.points.length > 2 && (
                              <g
                                className="pointer-events-auto cursor-pointer"
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); removeLastLine(route.id); }}
                              >
                                <title>Remove the last line</title>
                                <circle cx={remove.x} cy={remove.y} r={6} fill="white" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="2,2" />
                                <path d={`M ${remove.x - 3} ${remove.y} H ${remove.x + 3}`} stroke="#ef4444" strokeWidth={1.5} />
                              </g>
                            )}
                          </g>
                        );
                      })}

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
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              pushToUndoStack();
                              setDraggedPoint({
                                playerId: selectedPlayer.id,
                                routeId: route.id,
                                pointIndex: idx
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ))
                      ))}
                    </svg>
                  )}

                  {currentPlay?.players.map(player => (
                    <PlayerToken
                      key={player.id}
                      player={isDefenseView ? { ...player, color: NEUTRAL_OFFENSE_COLOR } : player}
                      isSelected={selectedPlayerId === player.id}
                      isDragging={draggedPlayer === player.id}
                      flipped={isDefenseView}
                      onSelect={(id) => {
                        if (isDefenseView) {
                          // Tap a receiver: the selected defender covers him man to man (tap again to undo)
                          const defender = currentPlay?.defense?.defenders.find(d => d.id === selectedDefenderId);
                          if (defender && player.role !== 'QB') {
                            updateDefender(defender.id, {
                              manTargetId: defender.manTargetId === id ? null : id, rush: false, zone: null,
                            });
                          }
                          return;
                        }
                        if (isSettingMotion) {
                          handleMotionSet(id);
                        } else if (!isDrawing) {
                          setSelectedPlayerId(id);
                        }
                      }}
                      onDragStart={(id) => {
                        if (!isDrawing && !isSettingMotion && !isDefenseView) {
                          dragTimerRef.current = setTimeout(() => {
                            pushToUndoStack();
                            setDraggedPlayer(id);
                            dragTimerRef.current = null;
                          }, 300);
                        }
                      }}
                    />
                  ))}

                  {/* Defense view: draggable defenders and the selected defender's zone handles */}
                  {isDefenseView && currentPlay?.defense?.defenders.map((defender, index) => (
                    <DefenderToken
                      key={defender.id}
                      defender={defender}
                      color={defenderColor(defender, index)}
                      isSelected={selectedDefenderId === defender.id}
                      onPress={(id) => {
                        if (defenderArrowPoints) return;
                        pushToUndoStack();
                        setSelectedDefenderId(id);
                        setDraggedDefender(id);
                      }}
                    />
                  ))}
                  {isDefenseView && (() => {
                    const index = currentPlay?.defense?.defenders.findIndex(d => d.id === selectedDefenderId) ?? -1;
                    const defender = index >= 0 ? currentPlay!.defense!.defenders[index] : null;
                    if (!defender?.zone || defenderArrowPoints) return null;
                    const center = { x: defender.position.x + defender.zone.dx, y: defender.position.y + defender.zone.dy };
                    const corner = { x: center.x + defender.zone.rx, y: center.y - defender.zone.ry };
                    const color = defenderColor(defender, index);
                    const startHandleDrag = (handle: 'move' | 'size') => (e: React.MouseEvent | React.TouchEvent) => {
                      e.stopPropagation();
                      pushToUndoStack();
                      const { clientX, clientY } = 'touches' in e ? e.touches[0] : e;
                      const grab = snapToGrid(toFieldPoint(clientX, clientY, fieldContainerRef.current!));
                      zoneGrabOffsetRef.current = { x: center.x - grab.x, y: center.y - grab.y };
                      setDraggedZoneHandle(handle);
                    };
                    // Under the defender tokens (z-20), so grabbing the X still moves the defender
                    return (
                      <svg className="absolute inset-0 pointer-events-none z-10" width="100%" height="100%">
                        <ellipse
                          cx={center.x} cy={center.y} rx={defender.zone.rx} ry={defender.zone.ry}
                          fill="transparent"
                          className="pointer-events-auto cursor-move"
                          onMouseDown={startHandleDrag('move')}
                          onTouchStart={startHandleDrag('move')}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <title>Drag to move the zone</title>
                        </ellipse>
                        <rect
                          x={corner.x - 7} y={corner.y - 7} width={14} height={14} rx={3}
                          fill="white" stroke={color} strokeWidth={2.5}
                          className="pointer-events-auto cursor-nesw-resize"
                          onMouseDown={startHandleDrag('size')}
                          onTouchStart={startHandleDrag('size')}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <title>Drag to resize the zone</title>
                        </rect>
                      </svg>
                    );
                  })()}
                  {/* Selected defender's arrow: drag its points (the last one is the tip) */}
                  {isDefenseView && !defenderArrowPoints && (() => {
                    const index = currentPlay?.defense?.defenders.findIndex(d => d.id === selectedDefenderId) ?? -1;
                    const defender = index >= 0 ? currentPlay!.defense!.defenders[index] : null;
                    if (!defender?.path?.length) return null;
                    const color = defenderColor(defender, index);
                    return (
                      <svg className="absolute inset-0 pointer-events-none z-20" width="100%" height="100%">
                        {defender.path.map((point, i) => (
                          <circle
                            key={i}
                            cx={point.x} cy={point.y} r={7}
                            fill="white" stroke={color} strokeWidth={2.5}
                            className="pointer-events-auto cursor-move"
                            onMouseDown={(e) => { e.stopPropagation(); pushToUndoStack(); setDraggedArrowPoint(i); }}
                            onTouchStart={(e) => { e.stopPropagation(); pushToUndoStack(); setDraggedArrowPoint(i); }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <title>{i === defender.path!.length - 1 ? 'Drag to move the arrow tip' : 'Drag to move this point'}</title>
                          </circle>
                        ))}
                      </svg>
                    );
                  })()}
                </Field>
                </div>
                </div>
              </div>

              {/* Below the field: defense controls in the defense view, otherwise the route controls.
                  Both stay rendered in the same grid cell, so switching views doesn't change the height */}
              <div className="w-full max-w-[880px] big:max-w-[1000px] grid" style={{ minWidth: FIELD_PX * fieldScale }}>
                <DefenseControls
                  className={cn("[grid-area:1/1]", !isDefenseView && "invisible")}
                  play={currentPlay}
                  defense={currentPlay?.defense ?? null}
                  selectedDefenderId={selectedDefenderId}
                  onApplyCoverage={selectCoverage}
                  onUpdateDefender={updateDefender}
                  isDrawingArrow={!!defenderArrowPoints}
                  onStartArrow={startDefenderArrow}
                  onFinishArrow={finishDefenderArrow}
                />
                <RouteControls
                  className={cn("[grid-area:1/1]", isDefenseView && "invisible")}
                  selectedPlayer={selectedPlayer}
                  activeRouteType={activeRouteType}
                  onSetActiveRouteType={setActiveRouteType}
                  onApplyRoute={(preset) => handleApplyRoute(preset, activeRouteType)}
                  onStartDrawing={startDrawing}
                  onFinishDrawing={finishDrawing}
                  onClearRoutes={clearRoutes}
                  isDrawing={isDrawing}
                  savedRoutes={savedRoutes}
                  onSaveRoute={handleSaveRoute}
                  onDeleteSavedRoute={handleDeleteSavedRoute}
                  onApplySavedRoute={(id, type) => handleApplySavedRoute(id, type)}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Right resize handle */}
        <div
          onMouseDown={startResize('right')}
          className="hidden md:block w-1 shrink-0 cursor-col-resize bg-slate-700 hover:bg-blue-500 transition-colors"
        />

        {/* Right Sidebar - Playbook Grid */}
        <PlaybookGrid
          className={cn(mobileTab === 'grid' ? 'flex md:flex' : 'hidden md:flex', 'w-full md:w-auto shrink-0')}
          style={isMobile ? undefined : { width: rightWidth }}
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
            setMobileTab('field');
          }}
          onOpenPrintSettings={() => setIsPrintModalOpen(true)}
          onExportPlaybook={() => setIsShareModalOpen(true)}
          onBackupAll={() => handleBackupAll()}
          onChangeBackupLocation={canPickBackupLocation ? () => handleBackupAll(true) : undefined}
          backupFileName={backupFileName}
          lastBackupAt={lastBackupAt}
        />
      </main>

      {/* Mobile: floating draw action bar */}
      {mobileTab === 'field' && selectedPlayer && (
        <div className="md:hidden fixed z-50 inset-x-0 bottom-16 px-4 flex gap-2" style={{ paddingBottom: 0 }}>
          {isDrawing ? (
            <>
              <button
                onClick={finishDrawing}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-xl text-sm"
              >
                ✓ Finish Route
              </button>
              <button
                onClick={cancelDrawing}
                className="bg-red-900/70 text-red-300 border border-red-800 px-5 py-3 rounded-xl font-bold shadow-xl text-sm"
              >
                ✗
              </button>
            </>
          ) : (
            <button
              onClick={startDrawing}
              className="flex-1 bg-blue-700 text-white py-3 rounded-xl font-bold shadow-xl text-sm"
            >
              ✦ Draw Route
            </button>
          )}
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav
        className="md:hidden flex border-t border-slate-700 bg-slate-900/95 backdrop-blur-sm shrink-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {(['plays', 'field', 'grid'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={cn(
              'flex-1 py-3 text-xs font-semibold uppercase tracking-wide transition-colors',
              mobileTab === tab ? 'text-blue-400' : 'text-slate-500'
            )}
          >
            {tab === 'plays' ? 'Plays' : tab === 'field' ? 'Field' : 'Grid'}
          </button>
        ))}
      </nav>

      {/* Modals & Print Layers */}
      {importConflicts && (
        <MergeModal conflicts={importConflicts.conflicts} onResolve={resolveImportConflicts} />
      )}
      {isCommentModalOpen && currentPlay && (
        <CommentModal
          playName={currentPlay.name}
          comment={currentPlay.comment || ''}
          onClose={() => setIsCommentModalOpen(false)}
          onSave={(comment) => {
            handleUpdatePlayComment(currentPlay.id, comment);
            setIsCommentModalOpen(false);
          }}
        />
      )}
      {isShareModalOpen && (
        <ShareModal
          playbooks={playbooks}
          currentPlaybookId={currentPlaybookId}
          onClose={() => setIsShareModalOpen(false)}
          onShare={handleExportPlaybooks}
        />
      )}
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

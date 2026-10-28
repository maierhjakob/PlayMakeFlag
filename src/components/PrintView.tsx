import { MiniPlayPreview, YARD_NUMBER_MARGIN } from './MiniPlayPreview';
import type { Playbook, Play } from '@/types';

interface PrintViewProps {
    playbook: Playbook;
    plays: Play[];
    playsPerPage: number;
}

export const PrintView: React.FC<PrintViewProps> = ({ playbook, plays, playsPerPage }) => {
    const ROWS = 4;
    const COLS = playbook.gridConfig.columnNames.length;

    // Match the preview's aspect ratio to the printed play cell (sizes in cm, from the print CSS below),
    // so narrower cells show more field depth instead of shrinking the play
    const PREVIEW_WIDTH = 120;
    const cellWidth = ((11.5 - 0.5) / COLS - 0.3) * 0.95; // card - row number column, minus tag column + padding
    const cellHeight = ((6.33 - 0.4) / ROWS) * 0.98;     // card - header row
    const previewHeight = Math.round(PREVIEW_WIDTH * (1 + YARD_NUMBER_MARGIN) * cellHeight / cellWidth);

    const getPlayAtCell = (row: number, col: number) => {
        return plays.find(p => p.gridPosition?.row === row && p.gridPosition?.column === col) || null;
    };

    // We render 'playsPerPage' number of grid cards.
    const cards = Array.from({ length: playsPerPage });

    return (
        <div className="print-view-container">
            {cards.map((_, cardIdx) => (
                <div key={cardIdx} className="print-card">
                    <div className="print-grid-table">
                        {/* Column Headers */}
                        <div className="print-grid-row print-grid-header">
                            <div className="print-grid-cell print-grid-row-num print-grid-corner" style={{ fontSize: '4pt' }}>
                                {playbook.name}
                            </div>
                            {playbook.gridConfig.columnNames.map((name, i) => (
                                <div key={i} className="print-grid-cell print-grid-col-header">
                                    {name}
                                </div>
                            ))}
                        </div>

                        {/* Rows */}
                        {Array.from({ length: ROWS }).map((_, r) => (
                            <div key={r} className="print-grid-row">
                                <div className="print-grid-cell print-grid-row-num">{r + 1}</div>
                                {Array.from({ length: COLS }).map((_, c) => {
                                    const play = getPlayAtCell(r, c);

                                    return (
                                        <div key={c} className="print-grid-cell print-grid-play-cell">
                                            {play && (
                                                <div className="print-play-box">
                                                    <MiniPlayPreview
                                                        play={play}
                                                        width={PREVIEW_WIDTH}
                                                        height={previewHeight}
                                                        strokeWidth={2.5}
                                                        className="print-mini-preview"
                                                        yardNumbersOutside
                                                    />
                                                    <div className="print-play-label-container">
                                                        {play.tags?.map(tag => (
                                                            <div
                                                                key={tag.id}
                                                                className="print-custom-tag"
                                                                style={{ color: tag.color }}
                                                            >
                                                                {tag.text}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <style>{`
                @media screen {
                    .print-view-container { display: none; }
                }

                @media print {
                    @page {
                        size: A4;
                        margin: 1cm;
                    }

                    body * { visibility: hidden; }
                    .print-view-container, .print-view-container * { visibility: visible; }
                    
                    .print-view-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.5cm;
                        background: white;
                    }

                    .print-card {
                        width: 11.5cm;
                        height: 6.33cm;
                        border: 1px solid black;
                        background: white;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        page-break-inside: avoid;
                    }

                    .print-grid-table {
                        height: 100%;
                        display: flex;
                        flex-direction: column;
                    }

                    .print-grid-row {
                        flex: 1;
                        min-height: 0;
                        display: flex;
                        border-bottom: 1px solid #333;
                    }

                    .print-grid-row:last-child {
                        border-bottom: none;
                    }

                    .print-grid-cell {
                        border-right: 1px solid #333;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }

                    .print-grid-cell:last-child {
                        border-right: none;
                    }

                    .print-grid-row-num {
                        width: 0.5cm;
                        font-weight: bold;
                        font-size: 7pt;
                        background: #f0f0f0;
                        -webkit-print-color-adjust: exact;
                    }

                    .print-grid-corner {
                        font-size: 6pt;
                        padding: 1px;
                        text-align: center;
                        line-height: 1.1;
                        word-break: break-all;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #e5e7eb;
                    }

                    .print-grid-col-header {
                        flex: 1;
                        font-weight: bold;
                        font-size: 8pt;
                        background: #f0f0f0;
                        -webkit-print-color-adjust: exact;
                    }

                    .print-grid-play-cell {
                        flex: 1;
                        padding: 0;
                    }

                    .print-grid-header {
                        height: 0.4cm;
                        flex: none;
                    }

                    .print-play-box {
                        display: flex;
                        flex-direction: row;
                        align-items: center;
                        justify-content: space-between;
                        width: 100%;
                        height: 100%;
                        padding: 0 2px 0 1px;
                    }

                    .print-mini-preview {
                        flex: 1;
                        min-width: 0;
                        width: 95%;
                        height: 98%;
                    }

                    .print-play-label-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 1px;
                        width: 8px;
                        height: 100%;
                        background: #fff;
                    }

                    .print-play-label {
                        font-family: sans-serif;
                        font-weight: 900;
                        font-size: 11pt;
                        color: #000;
                        line-height: 1;
                    }

                    .print-custom-tag {
                        font-family: sans-serif;
                        font-weight: 900;
                        font-size: 8pt;
                        line-height: 1;
                        text-align: right;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
};

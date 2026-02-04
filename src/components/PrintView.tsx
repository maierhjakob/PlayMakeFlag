import { MiniPlayPreview } from './MiniPlayPreview';
import type { Playbook } from '@/types';

interface PrintViewProps {
    playbook: Playbook;
    playsPerPage: number;
}

export const PrintView: React.FC<PrintViewProps> = ({ playbook, playsPerPage }) => {
    const ROWS = 4;
    const COLS = 5;

    const getPlayAtCell = (row: number, col: number) => {
        return playbook.plays.find(p => p.gridPosition?.row === row && p.gridPosition?.column === col) || null;
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
                            <div className="print-grid-cell print-grid-row-num print-grid-corner">
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
                                                        width={75}
                                                        height={50}
                                                        className="print-mini-preview"
                                                    />
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
                        width: 11cm;
                        height: 6cm;
                        border: 1px solid black;
                        background: white;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        page-break-inside: avoid;
                    }

                    .print-grid-table {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                    }

                    .print-grid-row {
                        flex: 1;
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
                        width: 1cm;
                        font-weight: bold;
                        font-size: 8pt;
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
                        height: 0.7cm;
                        flex: none;
                    }

                    .print-play-box {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                        height: 100%;
                        padding: 1px;
                    }

                    .print-mini-preview {
                        max-width: 98%;
                        max-height: 98%;
                    }
                }
            `}</style>
        </div>
    );
};

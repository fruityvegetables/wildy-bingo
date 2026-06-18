import { isCenterCell } from '../utils/bingo.js';

export default function BingoBoard({
  grid,
  size,
  onTileChange,
  marked,
  onToggleMark,
  readOnly = false,
  locked = false,
}) {
  const editable = !readOnly && !locked;

  return (
    <div
      className={`bingo-board ${readOnly || locked ? 'bingo-board-readonly' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
      }}
    >
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          const isCenter = isCenterCell(rowIndex, colIndex, size);
          const isMarked = marked?.has(key);

          if (isCenter) {
            return (
              <div key={key} className="bingo-tile bingo-tile-free">
                <span>{cell || 'FREE'}</span>
              </div>
            );
          }

          if (!editable) {
            return (
              <div
                key={key}
                className={`bingo-tile bingo-tile-readonly ${isMarked ? 'marked' : ''}`}
                onClick={() => onToggleMark?.(key)}
              >
                <span className="tile-text">{cell || '—'}</span>
              </div>
            );
          }

          return (
            <div
              key={key}
              className={`bingo-tile ${isMarked ? 'marked' : ''}`}
              onClick={() => onToggleMark?.(key)}
            >
              <textarea
                value={cell}
                onChange={(e) => onTileChange(rowIndex, colIndex, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                rows={2}
                placeholder="Tile text"
                aria-label={`Tile row ${rowIndex + 1} column ${colIndex + 1}`}
              />
            </div>
          );
        })
      )}
    </div>
  );
}

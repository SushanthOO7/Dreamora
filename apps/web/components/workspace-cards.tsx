type CardGridProps = {
  items: {
    title: string;
    eyebrow?: string;
    body: string;
    meta?: string[];
  }[];
};

export function CardGrid({ items }: CardGridProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          className="panel rounded-[30px] px-6 py-5"
        >
          {item.eyebrow ? (
            <p className="text-xs uppercase tracking-[0.22em] text-black/35">
              {item.eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {item.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-black/58">{item.body}</p>
          {item.meta ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {item.meta.map((entry) => (
                <span
                  key={entry}
                  className="rounded-full border border-black/8 bg-white/80 px-3 py-1 text-xs text-black/58"
                >
                  {entry}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  rows
}: {
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="panel overflow-hidden rounded-[32px]">
      <div className="grid grid-cols-1 border-b border-black/8 bg-white/65 px-5 py-4 text-sm font-medium text-black/55 md:grid-cols-[1.4fr_repeat(3,0.9fr)]">
        {columns.map((column) => (
          <div key={column}>{column}</div>
        ))}
      </div>
      <div>
        {rows.map((row, index) => (
          <div
            key={`${row[0]}-${index}`}
            className="grid grid-cols-1 gap-2 border-b border-black/6 px-5 py-4 last:border-b-0 md:grid-cols-[1.4fr_repeat(3,0.9fr)]"
          >
            {row.map((cell, cellIndex) => (
              <div
                key={`${cell}-${cellIndex}`}
                className={cellIndex === 0 ? "font-medium text-black" : "text-black/58"}
              >
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

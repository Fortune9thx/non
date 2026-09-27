/**
 * Original inline SVG art for Non.
 *
 * The reference language is classical sculpture set against warm pastoral
 * landscape. Everything here is drawn from primitives -- no external
 * image assets, no third-party artwork, nothing to license or to fail to
 * load. The palette is the same warm cream/ochre/sage family across every
 * plate so the pages read as one system.
 */

type PlateProps = { className?: string; seed?: number };

/** A warm pastoral valley: haze, layered hills, cypresses, a low sun. */
export function Landscape({ className, seed = 0 }: PlateProps) {
  const id = `ls${seed}`;
  return (
    <svg
      className={className}
      viewBox="0 0 800 520"
      role="img"
      aria-label="A pastoral valley under a low sun"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cdd9e2" />
          <stop offset="45%" stopColor="#e8e0cf" />
          <stop offset="100%" stopColor="#f6edd8" />
        </linearGradient>
        <linearGradient id={`${id}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a9b39c" />
          <stop offset="100%" stopColor="#c3c4a8" />
        </linearGradient>
        <linearGradient id={`${id}-mid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8f9a75" />
          <stop offset="100%" stopColor="#b0ab7f" />
        </linearGradient>
        <linearGradient id={`${id}-near`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7e8355" />
          <stop offset="100%" stopColor="#9c9560" />
        </linearGradient>
        <radialGradient id={`${id}-sun`} cx="0.68" cy="0.3" r="0.42">
          <stop offset="0%" stopColor="#fff6dd" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff6dd" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="800" height="520" fill={`url(#${id}-sky)`} />
      <circle cx="544" cy="156" r="38" fill="#fdf3d9" />
      <rect width="800" height="520" fill={`url(#${id}-sun)`} />

      {/* clouds */}
      <g fill="#ffffff" opacity="0.5">
        <ellipse cx="180" cy="104" rx="88" ry="22" />
        <ellipse cx="246" cy="96" rx="58" ry="17" />
        <ellipse cx="636" cy="80" rx="70" ry="16" />
      </g>

      {/* far ridge */}
      <path
        d="M0 268 L96 232 L186 262 L272 224 L370 258 L470 218 L578 254 L680 226 L800 260 L800 520 L0 520 Z"
        fill={`url(#${id}-far)`}
      />
      {/* middle hills */}
      <path
        d="M0 322 C120 288, 218 340, 324 314 C438 286, 530 336, 640 310 C716 292, 762 314, 800 304 L800 520 L0 520 Z"
        fill={`url(#${id}-mid)`}
      />
      {/* near field */}
      <path
        d="M0 396 C140 362, 250 414, 388 392 C520 370, 622 412, 800 380 L800 520 L0 520 Z"
        fill={`url(#${id}-near)`}
      />

      {/* field furrows */}
      <g stroke="#6f7449" strokeOpacity="0.3" strokeWidth="1.5" fill="none">
        <path d="M0 440 C180 414, 380 452, 800 420" />
        <path d="M0 470 C200 446, 420 482, 800 452" />
        <path d="M0 500 C220 478, 460 510, 800 486" />
      </g>

      {/* cypresses */}
      <g fill="#5c6440">
        {[
          [126, 392, 1],
          [158, 398, 0.78],
          [498, 378, 0.9],
          [530, 384, 0.66],
          [690, 372, 0.82],
        ].map(([x, y, s], i) => (
          <ellipse key={i} cx={x} cy={y - 34 * s} rx={9 * s} ry={38 * s} />
        ))}
      </g>

      {/* villa */}
      <g fill="#e4d7bc" stroke="#9c8f74" strokeWidth="1">
        <rect x="292" y="352" width="54" height="30" rx="2" />
        <path d="M286 352 L319 336 L352 352 Z" fill="#b9805f" stroke="none" />
      </g>
    </svg>
  );
}

/** A seated classical figure, rendered as pale marble. */
export function FigureSeated({ className }: PlateProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 260 380"
      role="img"
      aria-label="A seated classical marble figure"
    >
      <defs>
        <linearGradient id="mb1" x1="0.1" y1="0" x2="1" y2="0.9">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="42%" stopColor="#efeae1" />
          <stop offset="78%" stopColor="#d8d1c4" />
          <stop offset="100%" stopColor="#bfb7a8" />
        </linearGradient>
      </defs>

      {/* plinth */}
      <g fill="#e2dccf" stroke="#b5ada0" strokeWidth="0.9">
        <rect x="52" y="336" width="156" height="14" rx="2" />
        <rect x="62" y="322" width="136" height="15" rx="2" fill="#d8d1c3" />
      </g>

      <g fill="url(#mb1)" stroke="#b2aa9d" strokeWidth="0.9">
        {/* seated lower body: thigh running forward, drape falling behind */}
        <path d="M86 322 C82 286, 88 258, 104 240 L150 232 C168 246, 176 272, 174 300 L172 322 Z" />
        {/* forward knee + shin */}
        <path d="M150 262 C176 264, 198 274, 208 290 C213 298, 210 312, 202 314 C190 316, 176 302, 158 292 Z" />
        {/* torso, leaning slightly forward */}
        <path d="M104 242 C96 210, 100 178, 114 164 L146 158 C160 176, 162 208, 156 238 Z" />
        {/* trailing arm along the thigh */}
        <path d="M150 182 C170 190, 190 206, 198 222 C202 231, 196 238, 189 234 C174 226, 158 212, 146 204 Z" />
        {/* shoulder mass */}
        <path d="M112 170 C112 156, 124 148, 136 150 C148 152, 152 162, 150 174 Z" />
        {/* neck */}
        <path d="M126 140 L144 140 L146 156 L124 156 Z" />
        {/* head, tilted down in attention */}
        <ellipse cx="134" cy="118" rx="20" ry="24" transform="rotate(-8 134 118)" />
      </g>

      {/* hair, as a separate darker marble mass */}
      <path
        d="M113 116 C110 94, 124 82, 139 85 C155 88, 162 102, 158 116 C154 100, 144 94, 133 96 C124 98, 116 104, 113 116 Z"
        fill="#ded7ca"
      />

      {/* drapery folds */}
      <g stroke="#bcb4a6" strokeWidth="0.9" fill="none" opacity="0.85">
        <path d="M96 320 C94 288, 100 258, 112 242" />
        <path d="M114 320 C112 290, 116 262, 126 244" />
        <path d="M134 320 C134 292, 138 266, 146 248" />
        <path d="M154 320 C156 294, 160 274, 166 262" />
        <path d="M120 176 C130 196, 136 218, 138 238" />
      </g>
    </svg>
  );
}

/** A standing classical figure holding a tablet. */
export function FigureStanding({ className }: PlateProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 400"
      role="img"
      aria-label="A standing classical marble figure holding a tablet"
    >
      <defs>
        <linearGradient id="mb2" x1="0.1" y1="0" x2="1" y2="0.9">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="44%" stopColor="#ece7dd" />
          <stop offset="80%" stopColor="#d4cdbf" />
          <stop offset="100%" stopColor="#bcb4a5" />
        </linearGradient>
      </defs>

      <g fill="#e2dccf" stroke="#b5ada0" strokeWidth="0.9">
        <rect x="56" y="362" width="128" height="14" rx="2" />
        <rect x="66" y="348" width="108" height="15" rx="2" fill="#d8d1c3" />
      </g>

      <g fill="url(#mb2)" stroke="#b2aa9d" strokeWidth="0.9">
        {/* column of the robe, narrow and vertical */}
        <path d="M86 348 C88 288, 94 224, 104 186 L142 182 C154 222, 162 288, 164 348 Z" />
        {/* weight-bearing leg suggested through the drape */}
        <path d="M118 348 C118 292, 120 236, 124 196" fill="none" stroke="#bcb4a6" />
        {/* torso */}
        <path d="M104 188 C98 158, 102 132, 114 122 L140 120 C150 140, 150 166, 142 186 Z" />
        {/* near arm, lowered */}
        <path d="M106 136 C96 158, 92 186, 94 208 C95 216, 103 218, 105 211 C109 192, 114 170, 120 154 Z" />
        {/* far arm, raised, holding a tablet */}
        <path d="M140 134 C158 132, 176 140, 186 152 C191 158, 186 166, 179 162 C166 154, 152 150, 138 152 Z" />
        {/* shoulders */}
        <path d="M106 130 C106 118, 116 110, 127 111 C139 112, 144 120, 142 132 Z" />
        <path d="M117 104 L135 104 L137 120 L115 120 Z" />
        <ellipse cx="126" cy="84" rx="19" ry="23" />
      </g>

      {/* tablet */}
      <g>
        <rect x="172" y="128" width="46" height="34" rx="3" fill="#ded3bc" stroke="#b5ada0" strokeWidth="0.9" />
        <g stroke="#b9ae95" strokeWidth="1.1">
          <path d="M180 138 H210" />
          <path d="M180 145 H210" />
          <path d="M180 152 H198" />
        </g>
      </g>

      <path
        d="M106 82 C104 60, 118 49, 132 52 C147 55, 153 69, 149 83 C145 67, 134 61, 123 63 C114 65, 108 71, 106 82 Z"
        fill="#ded7ca"
      />

      <g stroke="#bcb4a6" strokeWidth="0.9" fill="none" opacity="0.85">
        <path d="M96 346 C98 290, 104 232, 112 198" />
        <path d="M132 346 C134 288, 138 234, 142 200" />
        <path d="M150 346 C152 296, 154 248, 152 214" />
      </g>
    </svg>
  );
}

/** A stone stair receding into haze — used for the "process" plate. */
export function Stairs({ className }: PlateProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 800 520"
      role="img"
      aria-label="A stone stair receding into warm haze"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="st-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e6dcc6" />
          <stop offset="100%" stopColor="#f7efdd" />
        </linearGradient>
        <linearGradient id="st-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#efe7d6" />
          <stop offset="100%" stopColor="#cfc4ac" />
        </linearGradient>
      </defs>
      <rect width="800" height="520" fill="url(#st-sky)" />
      <circle cx="400" cy="188" r="96" fill="#fff8e6" opacity="0.75" />

      {/* receding steps */}
      <g fill="url(#st-stone)" stroke="#bdb09a" strokeWidth="1">
        {Array.from({ length: 11 }).map((_, i) => {
          const t = i / 10;
          const w = 120 + t * 520;
          const y = 236 + t * t * 268;
          const h = 10 + t * 26;
          return (
            <rect key={i} x={400 - w / 2} y={y} width={w} height={h} rx={2} />
          );
        })}
      </g>

      {/* flanking balustrades */}
      <g fill="#ded3bc" opacity="0.9">
        <path d="M118 520 L196 300 L226 300 L168 520 Z" />
        <path d="M682 520 L604 300 L574 300 L632 520 Z" />
      </g>
    </svg>
  );
}

/** Two hands reaching toward one another — the "two independent readings" plate. */
export function Hands({ className }: PlateProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 800 420"
      role="img"
      aria-label="Two marble hands reaching toward one another"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="hd-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#efe4cc" />
          <stop offset="100%" stopColor="#dcd2b8" />
        </linearGradient>
        <linearGradient id="hd-mb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d3ccbe" />
        </linearGradient>
      </defs>
      <rect width="800" height="420" fill="url(#hd-bg)" />
      <circle cx="400" cy="210" r="132" fill="#fbf3e0" opacity="0.6" />

      <g fill="url(#hd-mb)" stroke="#b9b1a3" strokeWidth="1.2">
        {/* left arm + hand */}
        <path d="M0 268 L188 246 C232 240, 274 224, 316 208 C334 201, 352 200, 362 206 C372 212, 370 222, 356 226 L318 238 C300 244, 286 252, 272 256 L120 300 L0 312 Z" />
        <path d="M356 206 C368 200, 382 198, 390 202 C397 205, 396 212, 388 215 L360 224 Z" />
        {/* right arm + hand */}
        <path d="M800 288 L620 262 C576 256, 534 238, 492 220 C474 213, 456 212, 446 218 C436 224, 438 234, 452 238 L490 250 C508 256, 522 264, 536 268 L690 312 L800 330 Z" />
        <path d="M446 218 C434 212, 420 210, 412 214 C405 217, 406 224, 414 227 L442 236 Z" />
      </g>

      {/* the gap between fingertips */}
      <circle cx="400" cy="212" r="3.2" fill="#b9805f" opacity="0.55" />
    </svg>
  );
}

/** Small mark used beside the wordmark in the app shell. */
export function Seal({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeOpacity="0.28" />
      <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeOpacity="0.55" />
      <path d="M12 1.2 L12 6.2 M12 17.8 L12 22.8 M1.2 12 L6.2 12 M17.8 12 L22.8 12"
        stroke="currentColor" strokeOpacity="0.32" strokeWidth="1" />
    </svg>
  );
}

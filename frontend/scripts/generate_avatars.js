import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../public/avatars');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const avatars = {
  'totoro.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-totoro" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#E8F5E9" />
      <stop offset="100%" stop-color="#A5D6A7" />
    </radialGradient>
    <linearGradient id="body-totoro" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#8D99AE" />
      <stop offset="100%" stop-color="#6C757D" />
    </linearGradient>
  </defs>
  <!-- Background circle -->
  <circle cx="60" cy="60" r="56" fill="url(#bg-totoro)" stroke="#81C784" stroke-width="3" />
  
  <!-- Ears -->
  <path d="M42 42 C38 20, 44 14, 47 18 C50 22, 48 36, 46 44 Z" fill="url(#body-totoro)" />
  <path d="M78 42 C82 20, 76 14, 73 18 C70 22, 72 36, 74 44 Z" fill="url(#body-totoro)" />
  
  <!-- Leaf on head -->
  <path d="M56 28 C50 18, 68 16, 64 26 C62 30, 58 30, 56 28 Z" fill="#4CAF50" />
  <path d="M59 28 L63 20" stroke="#2E7D32" stroke-width="1.5" stroke-linecap="round" />

  <!-- Body -->
  <ellipse cx="60" cy="74" rx="42" ry="38" fill="url(#body-totoro)" />
  <!-- White Belly -->
  <ellipse cx="60" cy="78" rx="28" ry="24" fill="#FDFBF7" />
  <!-- Belly Marks -->
  <path d="M52 66 L55 69 L58 66" stroke="#6C757D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M62 66 L65 69 L68 66" stroke="#6C757D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M47 74 L50 77 L53 74" stroke="#6C757D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M57 74 L60 77 L63 74" stroke="#6C757D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M67 74 L70 77 L73 74" stroke="#6C757D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />

  <!-- Eyes -->
  <circle cx="45" cy="46" r="6" fill="#FFFFFF" />
  <circle cx="75" cy="46" r="6" fill="#FFFFFF" />
  <circle cx="46" cy="46" r="3" fill="#2B2D42" />
  <circle cx="74" cy="46" r="3" fill="#2B2D42" />
  <circle cx="47" cy="45" r="1.2" fill="#FFFFFF" />
  <circle cx="75" cy="45" r="1.2" fill="#FFFFFF" />

  <!-- Nose & Mouth -->
  <ellipse cx="60" cy="48" rx="3.5" ry="2" fill="#2B2D42" />
  <path d="M54 52 Q60 55 66 52" stroke="#2B2D42" stroke-width="1.5" stroke-linecap="round" fill="none" />

  <!-- Cute Whiskers -->
  <line x1="26" y1="48" x2="38" y2="49" stroke="#495057" stroke-width="1.5" stroke-linecap="round" />
  <line x1="24" y1="53" x2="37" y2="52" stroke="#495057" stroke-width="1.5" stroke-linecap="round" />
  <line x1="94" y1="48" x2="82" y2="49" stroke="#495057" stroke-width="1.5" stroke-linecap="round" />
  <line x1="96" y1="53" x2="83" y2="52" stroke="#495057" stroke-width="1.5" stroke-linecap="round" />

  <!-- Soft Pink Cheeks -->
  <ellipse cx="38" cy="54" rx="4.5" ry="2.5" fill="#FF8A80" opacity="0.6" />
  <ellipse cx="82" cy="54" rx="4.5" ry="2.5" fill="#FF8A80" opacity="0.6" />
</svg>`,

  'calcifer.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-calcifer" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FFF3E0" />
      <stop offset="100%" stop-color="#FFCC80" />
    </radialGradient>
    <linearGradient id="flame-outer" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FF3D00" />
      <stop offset="60%" stop-color="#FF6E40" />
      <stop offset="100%" stop-color="#FF9100" />
    </linearGradient>
    <linearGradient id="flame-inner" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFD600" />
      <stop offset="100%" stop-color="#FFAB00" />
    </linearGradient>
  </defs>
  <!-- Background -->
  <circle cx="60" cy="60" r="56" fill="url(#bg-calcifer)" stroke="#FFA726" stroke-width="3" />

  <!-- Sparkles -->
  <circle cx="28" cy="30" r="2" fill="#FF6D00" opacity="0.7" />
  <circle cx="92" cy="34" r="2.5" fill="#FF9100" opacity="0.8" />
  <circle cx="34" cy="85" r="1.5" fill="#FFAB00" opacity="0.6" />
  <circle cx="88" cy="82" r="2" fill="#FF6D00" opacity="0.7" />

  <!-- Outer Flame Body -->
  <path d="M60 16 
           C68 28, 76 22, 82 32 
           C90 42, 98 56, 94 74 
           C90 92, 74 100, 60 100 
           C46 100, 30 92, 26 74 
           C22 56, 30 42, 38 32 
           C44 22, 52 28, 60 16 Z" fill="url(#flame-outer)" />

  <!-- Inner Warm Glow -->
  <path d="M60 36 
           C66 44, 72 40, 76 48 
           C82 56, 86 68, 82 82 
           C78 94, 68 96, 60 96 
           C52 96, 42 94, 38 82 
           C34 68, 38 56, 44 48 
           C48 40, 54 44, 60 36 Z" fill="url(#flame-inner)" />

  <!-- Little Flame Arms -->
  <path d="M30 68 Q22 66 24 60" stroke="#FF5722" stroke-width="3.5" stroke-linecap="round" fill="none" />
  <path d="M90 68 Q98 66 96 60" stroke="#FF5722" stroke-width="3.5" stroke-linecap="round" fill="none" />

  <!-- Big Kawaii Eyes -->
  <circle cx="48" cy="62" r="7.5" fill="#FFFFFF" />
  <circle cx="72" cy="62" r="7.5" fill="#FFFFFF" />
  <circle cx="49" cy="62" r="4.5" fill="#212121" />
  <circle cx="71" cy="62" r="4.5" fill="#212121" />
  <circle cx="51" cy="60" r="1.8" fill="#FFFFFF" />
  <circle cx="73" cy="60" r="1.8" fill="#FFFFFF" />

  <!-- Cute Smiling Mouth with White Fang -->
  <path d="M50 75 Q60 86 70 75 Z" fill="#D50000" />
  <path d="M56 75 L60 78 L64 75 Z" fill="#FFFFFF" />

  <!-- Rosy Cheeks -->
  <ellipse cx="40" cy="71" rx="4" ry="2.5" fill="#FF1744" opacity="0.6" />
  <ellipse cx="80" cy="71" rx="4" ry="2.5" fill="#FF1744" opacity="0.6" />
</svg>`,

  'jiji.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-jiji" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#EDE7F6" />
      <stop offset="100%" stop-color="#D1C4E9" />
    </radialGradient>
    <linearGradient id="body-jiji" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2D3142" />
      <stop offset="100%" stop-color="#1E202B" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-jiji)" stroke="#B39DDB" stroke-width="3" />

  <!-- Big Cat Ears -->
  <path d="M34 46 L30 18 L50 36 Z" fill="url(#body-jiji)" />
  <path d="M35 40 L34 24 L47 34 Z" fill="#F48FB1" />
  <path d="M86 46 L90 18 L70 36 Z" fill="url(#body-jiji)" />
  <path d="M85 40 L86 24 L73 34 Z" fill="#F48FB1" />

  <!-- Sleek Head & Body -->
  <ellipse cx="60" cy="52" rx="26" ry="22" fill="url(#body-jiji)" />
  <path d="M46 72 C46 64, 74 64, 74 72 L78 98 C78 102, 42 102, 42 98 Z" fill="url(#body-jiji)" />

  <!-- Red Collar Bow -->
  <path d="M46 72 C55 76, 65 76, 74 72 C70 76, 50 76, 46 72 Z" fill="#E53935" />
  <circle cx="60" cy="74" r="3.5" fill="#FF1744" />
  <path d="M57 74 L51 71 L51 77 Z" fill="#D50000" />
  <path d="M63 74 L69 71 L69 77 Z" fill="#D50000" />

  <!-- Big Cute White & Dark Eyes -->
  <ellipse cx="48" cy="48" rx="8" ry="11" fill="#FFFFFF" />
  <ellipse cx="72" cy="48" rx="8" ry="11" fill="#FFFFFF" />
  <ellipse cx="49" cy="48" rx="5" ry="8" fill="#1A1C23" />
  <ellipse cx="71" cy="48" rx="5" ry="8" fill="#1A1C23" />
  <!-- Sparkles -->
  <circle cx="51" cy="45" r="2.2" fill="#FFFFFF" />
  <circle cx="73" cy="45" r="2.2" fill="#FFFFFF" />
  <circle cx="48" cy="52" r="1" fill="#FFFFFF" />
  <circle cx="70" cy="52" r="1" fill="#FFFFFF" />

  <!-- Tiny Pink Nose & Mouth -->
  <polygon points="60,56 58,54 62,54" fill="#FF80AB" />
  <path d="M57 58 Q60 61 63 58" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" fill="none" />

  <!-- Whiskers -->
  <line x1="30" y1="54" x2="42" y2="55" stroke="#78909C" stroke-width="1.2" stroke-linecap="round" />
  <line x1="28" y1="59" x2="41" y2="58" stroke="#78909C" stroke-width="1.2" stroke-linecap="round" />
  <line x1="90" y1="54" x2="78" y2="55" stroke="#78909C" stroke-width="1.2" stroke-linecap="round" />
  <line x1="92" y1="59" x2="79" y2="58" stroke="#78909C" stroke-width="1.2" stroke-linecap="round" />
</svg>`,

  'soot-sprite.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-soot" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#E0F7FA" />
      <stop offset="100%" stop-color="#B2EBF2" />
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-soot)" stroke="#80DEEA" stroke-width="3" />

  <!-- Sparkle Stars -->
  <path d="M26 32 L28 26 L30 32 L36 34 L30 36 L28 42 L26 36 L20 34 Z" fill="#FFE082" />
  <path d="M94 78 L95.5 73 L97 78 L102 79.5 L97 81 L95.5 86 L94 81 L89 79.5 Z" fill="#FF80AB" />
  <circle cx="86" cy="28" r="3" fill="#B388FF" opacity="0.8" />

  <!-- Fuzzy Spikes on Body -->
  <g fill="#212121">
    <circle cx="60" cy="60" r="32" />
    <!-- Radiating fluff fuzz -->
    <circle cx="34" cy="46" r="8" />
    <circle cx="30" cy="60" r="9" />
    <circle cx="36" cy="74" r="8" />
    <circle cx="48" cy="86" r="9" />
    <circle cx="64" cy="88" r="9" />
    <circle cx="78" cy="84" r="8" />
    <circle cx="88" cy="70" r="9" />
    <circle cx="88" cy="52" r="9" />
    <circle cx="80" cy="38" r="8" />
    <circle cx="66" cy="32" r="9" />
    <circle cx="48" cy="34" r="9" />
    <!-- Spiky little fur tufts -->
    <polygon points="26,48 20,44 26,40" />
    <polygon points="24,62 16,60 24,56" />
    <polygon points="28,74 20,78 28,82" />
    <polygon points="44,92 40,100 48,96" />
    <polygon points="68,94 72,102 74,94" />
    <polygon points="88,82 96,86 92,78" />
    <polygon points="94,56 102,54 94,48" />
    <polygon points="84,34 90,26 80,30" />
    <polygon points="56,28 58,18 64,28" />
    <polygon points="40,30 34,22 44,26" />
  </g>

  <!-- Big Kawaii Eyes -->
  <ellipse cx="48" cy="56" rx="9" ry="11" fill="#FFFFFF" />
  <ellipse cx="72" cy="56" rx="9" ry="11" fill="#FFFFFF" />
  <circle cx="50" cy="56" r="5" fill="#111111" />
  <circle cx="70" cy="56" r="5" fill="#111111" />
  <circle cx="52" cy="54" r="2" fill="#FFFFFF" />
  <circle cx="72" cy="54" r="2" fill="#FFFFFF" />

  <!-- Little hands holding a star candy (Konpeito) -->
  <g transform="translate(60, 78)">
    <polygon points="0,-9 3,-3 9,-3 4,1 6,7 0,3 -6,7 -4,1 -9,-3 -3,-3" fill="#FF80AB" stroke="#F50057" stroke-width="0.8" />
    <circle cx="-10" cy="-2" r="3" fill="#212121" />
    <circle cx="10" cy="-2" r="3" fill="#212121" />
  </g>

  <!-- Soft Pink Cheeks -->
  <ellipse cx="38" cy="65" rx="4" ry="2" fill="#FF4081" opacity="0.6" />
  <ellipse cx="82" cy="65" rx="4" ry="2" fill="#FF4081" opacity="0.6" />
</svg>`,

  'no-face.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="bg-noface" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E8EAF6" />
      <stop offset="100%" stop-color="#C5CAE9" />
    </linearGradient>
    <linearGradient id="cowl-noface" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#282828" />
      <stop offset="100%" stop-color="#121212" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-noface)" stroke="#9FA8DA" stroke-width="3" />

  <!-- Cherry blossom petals floating -->
  <path d="M24 30 C20 26, 26 22, 28 26 C30 22, 36 26, 32 30 C36 34, 30 38, 28 34 C26 38, 20 34, 24 30 Z" fill="#F8BBD0" opacity="0.8" />
  <circle cx="94" cy="34" r="2.5" fill="#F48FB1" opacity="0.7" />
  <circle cx="88" cy="86" r="3" fill="#F8BBD0" opacity="0.8" />

  <!-- Ghostly Black Cloak -->
  <path d="M60 22 
           C40 22, 32 40, 30 68 
           C28 88, 32 102, 60 102 
           C88 102, 92 88, 90 68 
           C88 40, 80 22, 60 22 Z" fill="url(#cowl-noface)" />

  <!-- White Ceramic Mask -->
  <ellipse cx="60" cy="58" rx="19" ry="26" fill="#FDFEFE" stroke="#E0E0E0" stroke-width="1" />

  <!-- Purple Markings Above Eyes -->
  <path d="M50 42 L54 42 L52 48 Z" fill="#7E57C2" />
  <path d="M70 42 L66 42 L68 48 Z" fill="#7E57C2" />

  <!-- Slanted Calm Eyes -->
  <ellipse cx="51" cy="53" rx="4" ry="2" fill="#212121" />
  <ellipse cx="69" cy="53" rx="4" ry="2" fill="#212121" />

  <!-- Purple Markings Below Eyes -->
  <path d="M50 58 L54 58 L52 66 Z" fill="#7E57C2" />
  <path d="M70 58 L66 58 L68 66 Z" fill="#7E57C2" />

  <!-- Little Calm Mouth -->
  <ellipse cx="60" cy="73" rx="3.5" ry="1.8" fill="#37474F" />

  <!-- Tiny Cute Hands holding a flower -->
  <ellipse cx="52" cy="88" rx="3" ry="2" fill="#424242" />
  <ellipse cx="68" cy="88" rx="3" ry="2" fill="#424242" />
  <!-- Small Flower -->
  <circle cx="60" cy="86" r="4" fill="#FF80AB" />
  <circle cx="60" cy="86" r="1.5" fill="#FFF59D" />
</svg>`,

  'ponyo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-ponyo" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#E1F5FE" />
      <stop offset="100%" stop-color="#81D4FA" />
    </radialGradient>
    <linearGradient id="hair-ponyo" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FF5252" />
      <stop offset="100%" stop-color="#D50000" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-ponyo)" stroke="#4FC3F7" stroke-width="3" />

  <!-- Water Bubbles -->
  <circle cx="28" cy="34" r="5" fill="#FFFFFF" opacity="0.6" />
  <circle cx="30" cy="32" r="1.5" fill="#FFFFFF" />
  <circle cx="92" cy="40" r="4" fill="#FFFFFF" opacity="0.6" />
  <circle cx="86" cy="80" r="6" fill="#FFFFFF" opacity="0.5" />

  <!-- Cute Chubby Body & Red Dress -->
  <ellipse cx="60" cy="86" rx="22" ry="16" fill="#FF5252" />
  <ellipse cx="60" cy="84" rx="14" ry="10" fill="#FFFFFF" />

  <!-- Tiny Fin Hands -->
  <ellipse cx="38" cy="82" rx="4.5" ry="3" fill="#FFCDD2" transform="rotate(-20 38 82)" />
  <ellipse cx="82" cy="82" rx="4.5" ry="3" fill="#FFCDD2" transform="rotate(20 82 82)" />

  <!-- Round Cute Head -->
  <ellipse cx="60" cy="56" rx="22" ry="20" fill="#FFEBEE" />

  <!-- Ponyo Fluffy Red Hair -->
  <path d="M38 52 
           C32 36, 44 26, 60 26 
           C76 26, 88 36, 82 52 
           C86 52, 88 44, 84 38 
           C80 24, 66 22, 60 22 
           C48 22, 36 26, 34 40 
           C32 46, 36 52, 38 52 Z" fill="url(#hair-ponyo)" />
  <!-- Cute Hair Tufts -->
  <path d="M42 42 Q48 34 54 44" fill="url(#hair-ponyo)" />
  <path d="M52 40 Q60 32 68 42" fill="url(#hair-ponyo)" />

  <!-- Big Innocent Anime Eyes -->
  <ellipse cx="48" cy="56" rx="6" ry="8" fill="#FFFFFF" />
  <ellipse cx="72" cy="56" rx="6" ry="8" fill="#FFFFFF" />
  <circle cx="49" cy="56" r="4.5" fill="#3E2723" />
  <circle cx="71" cy="56" r="4.5" fill="#3E2723" />
  <circle cx="51" cy="54" r="1.8" fill="#FFFFFF" />
  <circle cx="73" cy="54" r="1.8" fill="#FFFFFF" />

  <!-- Tiny Open Happy Mouth -->
  <path d="M56 66 Q60 72 64 66 Z" fill="#E91E63" />

  <!-- Rosy Cute Cheeks -->
  <ellipse cx="40" cy="62" rx="4" ry="2.5" fill="#FF4081" opacity="0.6" />
  <ellipse cx="80" cy="62" rx="4" ry="2.5" fill="#FF4081" opacity="0.6" />
</svg>`,

  'anya.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-anya" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FCE4EC" />
      <stop offset="100%" stop-color="#F8BBD0" />
    </radialGradient>
    <linearGradient id="hair-anya" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FF80AB" />
      <stop offset="100%" stop-color="#FF4081" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-anya)" stroke="#F48FB1" stroke-width="3" />

  <!-- Eden Academy Uniform Collar -->
  <path d="M42 88 L48 102 L72 102 L78 88 Z" fill="#212121" />
  <path d="M48 88 L60 96 L72 88 Z" fill="#FFFFFF" />
  <path d="M58 92 L62 92 L60 98 Z" fill="#FFD700" />

  <!-- Chibi Head -->
  <ellipse cx="60" cy="58" rx="26" ry="24" fill="#FFF3E0" />

  <!-- Anya Signature Pink Hair -->
  <path d="M34 56 
           C28 32, 40 22, 60 22 
           C80 22, 92 32, 86 56 
           C90 74, 86 86, 84 88 
           C82 78, 80 66, 78 62 
           C72 62, 70 42, 60 42 
           C50 42, 48 62, 42 62 
           C40 66, 38 78, 36 88 
           C34 86, 30 74, 34 56 Z" fill="url(#hair-anya)" />

  <!-- Bangs -->
  <path d="M42 46 Q50 56 56 46 Q62 56 70 44 Q76 54 80 46" stroke="url(#hair-anya)" stroke-width="4" stroke-linecap="round" fill="none" />

  <!-- Iconic Black & Gold Hair Horn Cones -->
  <polygon points="34,36 40,24 44,38" fill="#212121" stroke="#FFD700" stroke-width="2" />
  <polygon points="86,36 80,24 76,38" fill="#212121" stroke="#FFD700" stroke-width="2" />

  <!-- Big Green Anime Eyes with Sparkle -->
  <ellipse cx="47" cy="58" rx="6.5" ry="8.5" fill="#FFFFFF" />
  <ellipse cx="73" cy="58" rx="6.5" ry="8.5" fill="#FFFFFF" />
  <ellipse cx="47" cy="58" rx="4.5" ry="6.5" fill="#00C853" />
  <ellipse cx="73" cy="58" rx="4.5" ry="6.5" fill="#00C853" />
  <circle cx="48.5" cy="56" r="2.2" fill="#FFFFFF" />
  <circle cx="74.5" cy="56" r="2.2" fill="#FFFFFF" />
  <circle cx="46" cy="61" r="1.2" fill="#FFFFFF" />
  <circle cx="72" cy="61" r="1.2" fill="#FFFFFF" />

  <!-- Smug / Cute Smile -->
  <path d="M54 70 Q60 76 66 70" stroke="#D81B60" stroke-width="2" stroke-linecap="round" fill="none" />

  <!-- Blushing Cheeks -->
  <ellipse cx="38" cy="65" rx="4" ry="2.5" fill="#FF4081" opacity="0.6" />
  <ellipse cx="82" cy="65" rx="4" ry="2.5" fill="#FF4081" opacity="0.6" />
</svg>`,

  'chopper.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-chopper" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FFF8E1" />
      <stop offset="100%" stop-color="#FFE082" />
    </radialGradient>
    <linearGradient id="hat-chopper" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EC407A" />
      <stop offset="100%" stop-color="#C2185B" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-chopper)" stroke="#FFD54F" stroke-width="3" />

  <!-- Antlers -->
  <path d="M34 32 C30 18, 22 20, 24 16 C28 10, 36 20, 38 26 Z" fill="#8D6E63" />
  <path d="M86 32 C90 18, 98 20, 96 16 C92 10, 84 20, 82 26 Z" fill="#8D6E63" />

  <!-- Big Pink Top Hat -->
  <ellipse cx="60" cy="38" rx="34" ry="10" fill="url(#hat-chopper)" />
  <rect x="36" y="16" width="48" height="24" rx="8" fill="url(#hat-chopper)" />
  <!-- White Hat Cross -->
  <rect x="57" y="20" width="6" height="16" rx="2" fill="#FFFFFF" />
  <rect x="52" y="25" width="16" height="6" rx="2" fill="#FFFFFF" />

  <!-- Reindeer Head -->
  <ellipse cx="60" cy="64" rx="24" ry="22" fill="#D7CCC8" />

  <!-- Reindeer Ears -->
  <ellipse cx="32" cy="50" rx="6" ry="9" fill="#8D6E63" transform="rotate(-25 32 50)" />
  <ellipse cx="88" cy="50" rx="6" ry="9" fill="#8D6E63" transform="rotate(25 88 50)" />

  <!-- Eyes -->
  <ellipse cx="48" cy="60" rx="5" ry="7" fill="#FFFFFF" />
  <ellipse cx="72" cy="60" rx="5" ry="7" fill="#FFFFFF" />
  <circle cx="49" cy="60" r="3.5" fill="#3E2723" />
  <circle cx="71" cy="60" r="3.5" fill="#3E2723" />
  <circle cx="50" cy="58" r="1.5" fill="#FFFFFF" />
  <circle cx="72" cy="58" r="1.5" fill="#FFFFFF" />

  <!-- Signature Shiny Blue Nose -->
  <ellipse cx="60" cy="66" rx="4" ry="3.2" fill="#29B6F6" />
  <circle cx="61" cy="65" r="1" fill="#E1F5FE" />

  <!-- Happy Smile -->
  <path d="M54 72 Q60 78 66 72" stroke="#5D4037" stroke-width="2" stroke-linecap="round" fill="none" />

  <!-- Rosy Cheeks -->
  <ellipse cx="39" cy="68" rx="4" ry="2.5" fill="#FF8A80" opacity="0.6" />
  <ellipse cx="81" cy="68" rx="4" ry="2.5" fill="#FF8A80" opacity="0.6" />
</svg>`,

  'kodama.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-kodama" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#E8F5E9" />
      <stop offset="100%" stop-color="#C8E6C9" />
    </radialGradient>
    <radialGradient id="glow-kodama" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#E0F2F1" />
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-kodama)" stroke="#A5D6A7" stroke-width="3" />

  <!-- Forest Spores / Fireflies -->
  <circle cx="28" cy="30" r="2.5" fill="#FFF9C4" opacity="0.9" />
  <circle cx="92" cy="40" r="3" fill="#FFF9C4" opacity="0.8" />
  <circle cx="34" cy="85" r="2" fill="#E8F5E9" opacity="0.7" />
  <circle cx="86" cy="82" r="2.5" fill="#FFF9C4" opacity="0.9" />

  <!-- Small Slender Tree-Spirit Body -->
  <ellipse cx="60" cy="86" rx="12" ry="16" fill="url(#glow-kodama)" />
  <path d="M52 82 Q46 90 48 96" stroke="#CFD8DC" stroke-width="2.5" stroke-linecap="round" fill="none" />
  <path d="M68 82 Q74 90 72 96" stroke="#CFD8DC" stroke-width="2.5" stroke-linecap="round" fill="none" />

  <!-- Tilted Bulbous Bobble Head -->
  <g transform="rotate(-12 60 48)">
    <ellipse cx="60" cy="48" rx="24" ry="21" fill="url(#glow-kodama)" stroke="#B0BEC5" stroke-width="1.2" />
    <!-- Three Hollow Dark Circles (Curious Eyes & Mouth) -->
    <ellipse cx="50" cy="44" rx="4.5" ry="6" fill="#263238" />
    <ellipse cx="70" cy="44" rx="4.5" ry="6" fill="#263238" />
    <ellipse cx="60" cy="56" rx="3.5" ry="4.5" fill="#263238" />
  </g>
</svg>`,

  'kiki.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-kiki" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#F3E5F5" />
      <stop offset="100%" stop-color="#E1BEE7" />
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-kiki)" stroke="#CE93D8" stroke-width="3" />

  <!-- Dark Purple Witch Dress Collar -->
  <path d="M42 88 L48 102 L72 102 L78 88 Z" fill="#311B92" />
  <circle cx="60" cy="94" r="3" fill="#FFD54F" />

  <!-- Head -->
  <ellipse cx="60" cy="60" rx="22" ry="20" fill="#FFEBEE" />

  <!-- Bob Cut Dark Hair -->
  <path d="M38 58 
           C34 42, 42 34, 60 34 
           C78 34, 86 42, 82 58 
           C84 68, 80 74, 78 76 
           C74 72, 74 60, 72 56 
           C66 58, 64 48, 60 48 
           C56 48, 54 58, 48 56 
           C46 60, 46 72, 42 76 
           C40 74, 36 68, 38 58 Z" fill="#212121" />

  <!-- Signature Oversized Red Hair Bow -->
  <g transform="translate(60, 32)">
    <!-- Knot -->
    <ellipse cx="0" cy="0" rx="4" ry="5" fill="#D50000" />
    <!-- Left loop -->
    <path d="M-4 -2 C-16 -16, -26 -2, -4 2 Z" fill="#FF1744" stroke="#D50000" stroke-width="1" />
    <!-- Right loop -->
    <path d="M4 -2 C16 -16, 26 -2, 4 2 Z" fill="#FF1744" stroke="#D50000" stroke-width="1" />
  </g>

  <!-- Big Friendly Brown Eyes -->
  <ellipse cx="49" cy="58" rx="5" ry="7" fill="#FFFFFF" />
  <ellipse cx="71" cy="58" rx="5" ry="7" fill="#FFFFFF" />
  <circle cx="50" cy="58" r="3.5" fill="#3E2723" />
  <circle cx="70" cy="58" r="3.5" fill="#3E2723" />
  <circle cx="51" cy="56" r="1.5" fill="#FFFFFF" />
  <circle cx="71" cy="56" r="1.5" fill="#FFFFFF" />

  <!-- Cheerful Smile -->
  <path d="M55 68 Q60 73 65 68" stroke="#D81B60" stroke-width="2" stroke-linecap="round" fill="none" />

  <!-- Cheeks -->
  <ellipse cx="41" cy="64" rx="4" ry="2" fill="#FF8A80" opacity="0.6" />
  <ellipse cx="79" cy="64" rx="4" ry="2" fill="#FF8A80" opacity="0.6" />
</svg>`,

  'pochita.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-pochita" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FFF3E0" />
      <stop offset="100%" stop-color="#FFE0B2" />
    </radialGradient>
    <linearGradient id="body-pochita" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FF6D00" />
      <stop offset="100%" stop-color="#E65100" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-pochita)" stroke="#FFB74D" stroke-width="3" />

  <!-- Black Back Handle -->
  <path d="M48 32 C48 18, 72 18, 72 32" stroke="#212121" stroke-width="4.5" stroke-linecap="round" fill="none" />

  <!-- Chubby Orange Body -->
  <ellipse cx="60" cy="66" rx="34" ry="28" fill="url(#body-pochita)" />

  <!-- Chainsaw Blade on Nose -->
  <rect x="56" y="24" width="8" height="28" rx="2" fill="#B0BEC5" stroke="#78909C" stroke-width="1.5" />
  <!-- Saw Teeth -->
  <path d="M56 26 L52 28 L56 30 M56 34 L52 36 L56 38 M56 42 L52 44 L56 46" stroke="#546E7A" stroke-width="1.5" />
  <path d="M64 26 L68 28 L64 30 M64 34 L68 36 L64 38 M64 42 L68 44 L64 46" stroke="#546E7A" stroke-width="1.5" />

  <!-- Huge Puppy Eyes -->
  <circle cx="44" cy="64" r="9" fill="#FFFFFF" />
  <circle cx="76" cy="64" r="9" fill="#FFFFFF" />
  <circle cx="45" cy="64" r="6" fill="#212121" />
  <circle cx="75" cy="64" r="6" fill="#212121" />
  <circle cx="48" cy="62" r="2.5" fill="#FFFFFF" />
  <circle cx="78" cy="62" r="2.5" fill="#FFFFFF" />
  <circle cx="43" cy="67" r="1.2" fill="#FFFFFF" />
  <circle cx="73" cy="67" r="1.2" fill="#FFFFFF" />

  <!-- Cute Tongue sticking out -->
  <path d="M57 76 Q60 84 63 76 Z" fill="#FF4081" />

  <!-- Little Stumpy Paws -->
  <ellipse cx="42" cy="92" rx="6" ry="4" fill="#E65100" />
  <ellipse cx="78" cy="92" rx="6" ry="4" fill="#E65100" />

  <!-- Cheeks -->
  <ellipse cx="34" cy="72" rx="4" ry="2.5" fill="#FF1744" opacity="0.5" />
  <ellipse cx="86" cy="72" rx="4" ry="2.5" fill="#FF1744" opacity="0.5" />
</svg>`,

  'nezuko.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-nezuko" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FCE4EC" />
      <stop offset="100%" stop-color="#F8BBD0" />
    </radialGradient>
    <linearGradient id="hair-nezuko" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="60%" stop-color="#212121" />
      <stop offset="100%" stop-color="#FF6D00" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-nezuko)" stroke="#F48FB1" stroke-width="3" />

  <!-- Kimono Collar (Pink Asanoha & Brown Haori) -->
  <path d="M40 88 L46 102 L74 102 L80 88 Z" fill="#4E342E" />
  <path d="M46 88 L60 98 L74 88 Z" fill="#F48FB1" />
  <path d="M52 88 L60 94 L68 88 Z" fill="#FFFFFF" />

  <!-- Chibi Head -->
  <ellipse cx="60" cy="56" rx="24" ry="22" fill="#FFF3E0" />

  <!-- Flowing Black Hair with Orange Tips -->
  <path d="M34 54 
           C30 32, 40 22, 60 22 
           C80 22, 90 32, 86 54 
           C90 74, 88 88, 86 92 
           C82 82, 82 70, 78 64 
           C72 64, 70 42, 60 42 
           C50 42, 48 64, 42 64 
           C38 70, 38 82, 34 92 
           C32 88, 30 74, 34 54 Z" fill="url(#hair-nezuko)" />

  <!-- Pink Ribbon Clip on Side -->
  <g transform="translate(42, 32)">
    <rect x="-4" y="-3" width="8" height="6" rx="1.5" fill="#FF4081" />
    <path d="M-4 0 L-8 -4 L-8 4 Z" fill="#F50057" />
    <path d="M4 0 L8 -4 L8 4 Z" fill="#F50057" />
  </g>

  <!-- Big Soft Pink Gradient Eyes -->
  <ellipse cx="48" cy="54" rx="6" ry="8.5" fill="#FFFFFF" />
  <ellipse cx="72" cy="54" rx="6" ry="8.5" fill="#FFFFFF" />
  <ellipse cx="48" cy="54" rx="4.5" ry="6.5" fill="#EC407A" />
  <ellipse cx="72" cy="54" rx="4.5" ry="6.5" fill="#EC407A" />
  <circle cx="49.5" cy="52" r="2" fill="#FFFFFF" />
  <circle cx="73.5" cy="52" r="2" fill="#FFFFFF" />

  <!-- Bamboo Muzzle with Red Tie -->
  <rect x="44" y="66" width="32" height="10" rx="5" fill="#81C784" stroke="#4CAF50" stroke-width="1.5" />
  <line x1="52" y1="66" x2="52" y2="76" stroke="#2E7D32" stroke-width="1.2" />
  <line x1="68" y1="66" x2="68" y2="76" stroke="#2E7D32" stroke-width="1.2" />
  <!-- Red Cord -->
  <path d="M38 71 L44 71 M76 71 L82 71" stroke="#D50000" stroke-width="2" stroke-linecap="round" />

  <!-- Soft Pink Cheeks -->
  <ellipse cx="38" cy="62" rx="4" ry="2.5" fill="#FF4081" opacity="0.6" />
  <ellipse cx="82" cy="62" rx="4" ry="2.5" fill="#FF4081" opacity="0.6" />
</svg>`,

  'frieren.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-frieren" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#E8EAF6" />
      <stop offset="100%" stop-color="#C5CAE9" />
    </radialGradient>
    <linearGradient id="hair-frieren" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#E0E0E0" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-frieren)" stroke="#9FA8DA" stroke-width="3" />

  <!-- Capelet & Scarf -->
  <path d="M42 88 L50 102 L70 102 L78 88 Z" fill="#ECEFF1" stroke="#CFD8DC" stroke-width="1" />
  <path d="M48 88 L60 96 L72 88 Z" fill="#B0BEC5" />

  <!-- Long Elf Ears -->
  <path d="M34 56 C20 48, 16 42, 18 38 C22 38, 28 46, 36 50 Z" fill="#FFF3E0" stroke="#FFCCBC" stroke-width="1" />
  <path d="M86 56 C100 48, 104 42, 102 38 C98 38, 92 46, 84 50 Z" fill="#FFF3E0" stroke="#FFCCBC" stroke-width="1" />
  <!-- Red Drop Earrings -->
  <circle cx="24" cy="50" r="2.5" fill="#E53935" />
  <circle cx="96" cy="50" r="2.5" fill="#E53935" />

  <!-- Head -->
  <ellipse cx="60" cy="56" rx="22" ry="20" fill="#FFF3E0" />

  <!-- White Hair with Twin Low Tails -->
  <path d="M36 52 
           C32 36, 42 26, 60 26 
           C78 26, 88 36, 84 52 
           C86 64, 82 74, 80 82 
           C76 72, 74 60, 72 56 
           C66 56, 64 46, 60 46 
           C56 46, 54 56, 48 56 
           C46 60, 44 72, 40 82 
           C38 74, 34 64, 36 52 Z" fill="url(#hair-frieren)" />

  <!-- Serene Green Anime Eyes -->
  <ellipse cx="49" cy="56" rx="5" ry="7" fill="#FFFFFF" />
  <ellipse cx="71" cy="56" rx="5" ry="7" fill="#FFFFFF" />
  <ellipse cx="49" cy="56" rx="3.5" ry="5.5" fill="#43A047" />
  <ellipse cx="71" cy="56" rx="3.5" ry="5.5" fill="#43A047" />
  <circle cx="50" cy="54" r="1.5" fill="#FFFFFF" />
  <circle cx="72" cy="54" r="1.5" fill="#FFFFFF" />

  <!-- Calm Little Smile -->
  <path d="M56 66 Q60 69 64 66" stroke="#90A4AE" stroke-width="1.8" stroke-linecap="round" fill="none" />

  <!-- Cheeks -->
  <ellipse cx="41" cy="62" rx="3.5" ry="2" fill="#FF8A80" opacity="0.5" />
  <ellipse cx="79" cy="62" rx="3.5" ry="2" fill="#FF8A80" opacity="0.5" />
</svg>`,

  'pikachu.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-pika" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FFFDE7" />
      <stop offset="100%" stop-color="#FFF59D" />
    </radialGradient>
    <linearGradient id="body-pika" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFEE58" />
      <stop offset="100%" stop-color="#FDD835" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-pika)" stroke="#FBC02D" stroke-width="3" />

  <!-- Long Yellow Ears with Black Tips -->
  <path d="M38 42 L22 14 Q26 12 36 24 L46 38 Z" fill="url(#body-pika)" />
  <path d="M22 14 L28 12 L33 19 L26 21 Z" fill="#212121" />
  <path d="M82 42 L98 14 Q94 12 84 24 L74 38 Z" fill="url(#body-pika)" />
  <path d="M98 14 L92 12 L87 19 L94 21 Z" fill="#212121" />

  <!-- Chubby Round Face -->
  <ellipse cx="60" cy="66" rx="30" ry="26" fill="url(#body-pika)" />

  <!-- Eyes -->
  <circle cx="46" cy="60" r="6" fill="#212121" />
  <circle cx="74" cy="60" r="6" fill="#212121" />
  <circle cx="48" cy="58" r="2.2" fill="#FFFFFF" />
  <circle cx="76" cy="58" r="2.2" fill="#FFFFFF" />

  <!-- Tiny Nose -->
  <polygon points="60,65 58,63 62,63" fill="#212121" />

  <!-- Iconic Happy W-Mouth -->
  <path d="M52 69 Q56 73 60 70 Q64 73 68 69" stroke="#212121" stroke-width="2" stroke-linecap="round" fill="none" />
  <path d="M56 71 Q60 78 64 71 Z" fill="#E53935" />

  <!-- Big Red Cheeks -->
  <circle cx="36" cy="70" r="7" fill="#FF1744" />
  <circle cx="84" cy="70" r="7" fill="#FF1744" />
</svg>`,

  'catbus.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-catbus" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#FFF8E1" />
      <stop offset="100%" stop-color="#FFE082" />
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-catbus)" stroke="#FFCA28" stroke-width="3" />

  <!-- Destination Sign on Head -->
  <rect x="46" y="24" width="28" height="10" rx="3" fill="#FFB300" stroke="#E65100" stroke-width="1.2" />
  <!-- Mice Eyes on sign -->
  <circle cx="50" cy="22" r="2.5" fill="#E53935" />
  <circle cx="70" cy="22" r="2.5" fill="#E53935" />

  <!-- Cat Ears -->
  <polygon points="32,46 26,26 44,36" fill="#8D6E63" />
  <polygon points="32,42 29,30 40,36" fill="#F8BBD0" />
  <polygon points="88,46 94,26 76,36" fill="#8D6E63" />
  <polygon points="88,42 91,30 80,36" fill="#F8BBD0" />

  <!-- Fluffy Wide Cheeks Face -->
  <ellipse cx="60" cy="64" rx="36" ry="26" fill="#D7CCC8" />
  <path d="M26 62 Q18 64 24 72 Q34 74 38 68 Z" fill="#D7CCC8" />
  <path d="M94 62 Q102 64 96 72 Q86 74 82 68 Z" fill="#D7CCC8" />

  <!-- Brown Fur Stripes on Forehead -->
  <line x1="60" y1="38" x2="60" y2="46" stroke="#5D4037" stroke-width="2.5" stroke-linecap="round" />
  <line x1="53" y1="40" x2="55" y2="47" stroke="#5D4037" stroke-width="2.5" stroke-linecap="round" />
  <line x1="67" y1="40" x2="65" y2="47" stroke="#5D4037" stroke-width="2.5" stroke-linecap="round" />

  <!-- Glowing Yellow Eyes -->
  <ellipse cx="44" cy="54" rx="8" ry="7" fill="#FFEB3B" stroke="#F57F17" stroke-width="1.5" />
  <ellipse cx="76" cy="54" rx="8" ry="7" fill="#FFEB3B" stroke="#F57F17" stroke-width="1.5" />
  <ellipse cx="44" cy="54" rx="2.5" ry="6" fill="#212121" />
  <ellipse cx="76" cy="54" rx="2.5" ry="6" fill="#212121" />

  <!-- Big Wide Cheshire Tooth Grin -->
  <path d="M34 68 Q60 88 86 68 Q60 74 34 68 Z" fill="#FFFFFF" stroke="#4E342E" stroke-width="2" />
  <line x1="44" y1="71" x2="44" y2="76" stroke="#4E342E" stroke-width="1.2" />
  <line x1="52" y1="72" x2="52" y2="78" stroke="#4E342E" stroke-width="1.2" />
  <line x1="60" y1="73" x2="60" y2="79" stroke="#4E342E" stroke-width="1.2" />
  <line x1="68" y1="72" x2="68" y2="78" stroke="#4E342E" stroke-width="1.2" />
  <line x1="76" y1="71" x2="76" y2="76" stroke="#4E342E" stroke-width="1.2" />

  <!-- Whiskers -->
  <line x1="20" y1="64" x2="32" y2="64" stroke="#4E342E" stroke-width="1.5" stroke-linecap="round" />
  <line x1="18" y1="70" x2="30" y2="68" stroke="#4E342E" stroke-width="1.5" stroke-linecap="round" />
  <line x1="100" y1="64" x2="88" y2="64" stroke="#4E342E" stroke-width="1.5" stroke-linecap="round" />
  <line x1="102" y1="70" x2="90" y2="68" stroke="#4E342E" stroke-width="1.5" stroke-linecap="round" />
</svg>`,

  'luna.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-luna" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#EDE7F6" />
      <stop offset="100%" stop-color="#D1C4E9" />
    </radialGradient>
    <linearGradient id="body-luna" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#311B92" />
      <stop offset="100%" stop-color="#1A237E" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-luna)" stroke="#B39DDB" stroke-width="3" />

  <!-- Pointy Cat Ears -->
  <polygon points="34,46 26,18 48,36" fill="url(#body-luna)" />
  <polygon points="34,40 30,24 44,34" fill="#F48FB1" />
  <polygon points="86,46 94,18 72,36" fill="url(#body-luna)" />
  <polygon points="86,40 90,24 76,34" fill="#F48FB1" />

  <!-- Sleek Head & Body -->
  <ellipse cx="60" cy="56" rx="26" ry="22" fill="url(#body-luna)" />
  <ellipse cx="60" cy="88" rx="20" ry="16" fill="url(#body-luna)" />

  <!-- Iconic Gold Crescent Moon on Forehead -->
  <path d="M57 36 A6 6 0 1 0 63 46 A4.5 4.5 0 1 1 57 36 Z" fill="#FFD700" stroke="#FFA000" stroke-width="0.8" />

  <!-- Large Magical Ruby-Magenta Eyes -->
  <ellipse cx="48" cy="56" rx="7" ry="9" fill="#FFFFFF" />
  <ellipse cx="72" cy="56" rx="7" ry="9" fill="#FFFFFF" />
  <ellipse cx="48" cy="56" rx="5" ry="7" fill="#C2185B" />
  <ellipse cx="72" cy="56" rx="5" ry="7" fill="#C2185B" />
  <circle cx="50" cy="53" r="2" fill="#FFFFFF" />
  <circle cx="74" cy="53" r="2" fill="#FFFFFF" />

  <!-- Tiny Pink Nose & Mouth -->
  <polygon points="60,63 58,61 62,61" fill="#FF80AB" />
  <path d="M57 65 Q60 67 63 65" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" fill="none" />

  <!-- Whiskers -->
  <line x1="28" y1="60" x2="40" y2="61" stroke="#9FA8DA" stroke-width="1.2" stroke-linecap="round" />
  <line x1="26" y1="65" x2="39" y2="64" stroke="#9FA8DA" stroke-width="1.2" stroke-linecap="round" />
  <line x1="92" y1="60" x2="80" y2="61" stroke="#9FA8DA" stroke-width="1.2" stroke-linecap="round" />
  <line x1="94" y1="65" x2="81" y2="64" stroke="#9FA8DA" stroke-width="1.2" stroke-linecap="round" />
</svg>`,

  'gojo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="bg-gojo" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#E1F5FE" />
      <stop offset="100%" stop-color="#B3E5FC" />
    </radialGradient>
    <linearGradient id="hair-gojo" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#ECEFF1" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#bg-gojo)" stroke="#81D4FA" stroke-width="3" />

  <!-- Blue Curse Sparkles -->
  <polygon points="26,30 28,24 30,30 36,32 30,34 28,40 26,34 20,32" fill="#00E5FF" />
  <polygon points="94,76 95.5,71 97,76 102,77.5 97,79 95.5,84 94,79 89,77.5" fill="#2979FF" />

  <!-- High Dark Collar -->
  <path d="M42 86 L48 102 L72 102 L78 86 Z" fill="#1A237E" />
  <path d="M44 86 C54 84, 66 84, 76 86 L74 94 C64 92, 54 92, 46 94 Z" fill="#283593" />

  <!-- Chibi Head -->
  <ellipse cx="60" cy="58" rx="23" ry="21" fill="#FFF3E0" />

  <!-- Spiky Snow-White Hair -->
  <g fill="url(#hair-gojo)">
    <polygon points="32,46 22,34 38,36" />
    <polygon points="34,36 30,20 46,26" />
    <polygon points="44,24 48,12 58,22" />
    <polygon points="56,20 62,10 70,22" />
    <polygon points="68,22 78,14 78,28" />
    <polygon points="76,28 92,24 82,38" />
    <polygon points="80,38 98,40 84,48" />
    <!-- Hair Base -->
    <ellipse cx="60" cy="40" rx="26" ry="18" />
  </g>

  <!-- Sleek Black Blindfold -->
  <path d="M34 50 Q60 46 86 50 L86 64 Q60 68 34 64 Z" fill="#121212" stroke="#212121" stroke-width="1.5" />
  <path d="M36 54 Q60 51 84 54" stroke="#424242" stroke-width="1.5" stroke-linecap="round" fill="none" />

  <!-- Confident Smirk -->
  <path d="M54 72 Q62 76 66 70" stroke="#D81B60" stroke-width="2" stroke-linecap="round" fill="none" />

  <!-- Cheeks -->
  <ellipse cx="40" cy="68" rx="4" ry="2" fill="#FF8A80" opacity="0.6" />
  <ellipse cx="80" cy="68" rx="4" ry="2" fill="#FF8A80" opacity="0.6" />
</svg>`
};

for (const [filename, svg] of Object.entries(avatars)) {
  const filePath = path.join(outDir, filename);
  fs.writeFileSync(filePath, svg.trim(), 'utf8');
  console.log(`Generated: ${filename}`);
}

console.log('All 16 cute anime avatars successfully generated!');

import { useState } from "react";
import { Layers, Rotate3d, Compass, Maximize2, Zap, LayoutGrid, Info, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BlueprintRoom } from "@/types";
import { APP_TRANSLATIONS } from "@/translations";

interface BilingualBlueprintRoom extends BlueprintRoom {
  englishDetails?: string;
}

export default function InteractiveBlueprint({ lang }: { lang: "ar" | "en" }) {
  const [is3D, setIs3D] = useState(true);
  const [activeFloor, setActiveFloor] = useState<"ground" | "first" | "roof">("ground");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("main-majlis");
  const [rotX, setRotX] = useState<number>(30);
  const [rotZ, setRotZ] = useState<number>(-45);
  const [elevation, setElevation] = useState<number>(100);
  const [showAnnotations, setShowAnnotations] = useState(true);

  const t = APP_TRANSLATIONS[lang];

  // Elite structural rooms designed by Mohammed Kaid
  const groundRooms: BilingualBlueprintRoom[] = [
    {
      id: "main-majlis",
      name: "Grand Salon & Double-Height Majlis",
      arabicName: "الصالون الرئيسي والمجلس الكبير",
      x: 1, y: 1, w: 3, h: 2,
      elevation: 0,
      color: "from-amber-500/20 to-gold-500/30",
      details: "فراغ استقبال ممتد بارتفاع مزدوج (Double Height) ذو جدران خرسانية لوحية ملامسة لألواح خشب الجوز المعالج السوبر فخم.",
      englishDetails: "Expansive double-height grand salon featuring exposed architectural concrete panels contrasting warm premium walnut wood claddings.",
      technicalDetails: "H-Span: 8.4m | Cantilever: 2.2m | Concrete: C40/50 with Silica Fume. Glazing: Double-tempered low-E (6mm+12Argon+6mm).",
    },
    {
      id: "infinity-pool",
      name: "Edge Infinity Pool & Landscape Deck",
      arabicName: "مسبح لامتناهي وتنسيق اللاندسكيب",
      x: 4, y: 1, w: 2, h: 3,
      elevation: -5,
      color: "from-cyan-500/20 to-blue-600/30",
      details: "مسبح خارجي لامتناهي متماسك مع التضاريس الطبيعية للموقع، مجاور لجلسة غائرة دافئة تحت منسوب الحافة المائية للاندماج البصري.",
      englishDetails: "Outdoor infinity-edge pool integrated beautifully into the site topography, flanked by a cozy sunken fireplace lounge.",
      technicalDetails: "Spillway discharge: 24 m³/h | Waterproofing: Double-cementitious polyurethane | Perimeter negative-slope gravel channels.",
    },
    {
      id: "gallery-lobby",
      name: "Central Curved Galleria Lobby",
      arabicName: "بهو المعرض المركزي",
      x: 1, y: 3, w: 3, h: 1,
      elevation: 0,
      color: "from-slate-600/20 to-gold-600/20",
      details: "منطقة موزع ومحور حركة رئيسي يحتوي على سلم دائري خرساني مصبوب في الموقع دون عمود دعم مركزي لإظهار التحدي المعماري.",
      englishDetails: "Grand core distribution lobby featuring a structural helical cantilevered concrete staircase cast on-site without central column supports.",
      technicalDetails: "Helical rad: 1.5m | Steel reinforcement: High-yield grade 500B | Torsional shear designed via finite element model modeling.",
    },
    {
      id: "outdoor-terrace",
      name: "Sunken Outdoor Firepit Lounge",
      arabicName: "جلسة خارجية غائرة وموقد ناري",
      x: 4, y: 4, w: 2, h: 1,
      elevation: -15,
      color: "from-gold-600/10 to-amber-600/20",
      details: "جلسة غائرة بسطح خرساني مصقول مع حوض تفاعلي للنار ومحيط من الجلسات النحاسية الفخمة في أوقات الغروب.",
      englishDetails: "Sunken conversation pit with polished micro-cement finishes, central interactive ethanol firepit, and fragrant lavender surrounds.",
      technicalDetails: "Retention wall: Reinforced brick with geotextile membrane | Drainage: Automatic sub-slab sump pump connected to smart control board.",
    },
  ];

  const firstRooms: BilingualBlueprintRoom[] = [
    {
      id: "master-suite",
      name: "Master Executive Penthouse Suite",
      arabicName: "جناح النوم الرئيسي الماستر",
      x: 1, y: 1, w: 3, h: 2,
      elevation: 25,
      color: "from-amber-600/30 to-gold-700/30",
      details: "الجناح الرئاسي الممتاز يطل بفتحة سماوية ذكية متحركة لكشف النجوم ومحمي بكسرات شمسية نحاسية رأسية متحركة لتكييف الضوء تلقائياً.",
      englishDetails: "Luxury executive bedroom suite featuring an automated smart skylight dome and motorized vertical brass louvres to micro-control natural light.",
      technicalDetails: "Servo actuators linked to solar compass | Structural slab: 220px Flat-slab with punching shear drop-heads | STC: 55dB.",
    },
    {
      id: "glass-bridge",
      name: "Suspended Glass Skybridge",
      arabicName: "جسر زجاجي معلق",
      x: 4, y: 2, w: 2, h: 1,
      elevation: 30,
      color: "from-cyan-400/25 to-slate-400/20",
      details: "جسر ربط زجاجي بفتحات كاملة وهيكل فولاذي أنيق يربط الجناح الرئيسي بالمكتب الهندسي ومطل على المسبح الخارجي والحدائق.",
      englishDetails: "Structural glass walkway with high-tensile steel frames connecting the penthouses with the work branch, floating above the garden.",
      technicalDetails: "Structural steel: S355JR hollow sections | Glass panel: Triple-laminated with Vanceva acoustic interlayers | Deflection: < L/500.",
    },
    {
      id: "executive-office",
      name: "Architectural Studio & Office",
      arabicName: "المكتب المعماري الهندسي",
      x: 1, y: 3, w: 3, h: 2,
      elevation: 25,
      color: "from-zinc-700/30 to-gold-500/20",
      details: "فضاء عمل المهندس محمد، يوفر رؤية بانورامية كاملة للموقع ونظام تهوية طبيعية متكامل يعتمد على فرق الضغط الهوائي الديناميكي.",
      englishDetails: "Architectural design bullpen and executive office, providing panoramic site visuals and natural ventilation shafts powered by draft pressure.",
      technicalDetails: "Acoustic control: Perforated oak acoustic clouds with mineral wool backing | Smart vent: Windcatcher louvers with automated flow limits.",
    },
  ];

  const roofRooms: BilingualBlueprintRoom[] = [
    {
      id: "sky-garden",
      name: "Sky Oasis Terrace & Green Roof",
      arabicName: "واحة السطح والحديقة السماوية",
      x: 1, y: 1, w: 4, h: 2,
      elevation: 50,
      color: "from-emerald-500/20 to-gold-600/20",
      details: "مسطحات خضراء سماوية ذكية لعزل الحرارة تجمع بين الاستدامة البيئية ورفاهية الفخامة، ونظام تدوير المياه الرمادية للري.",
      englishDetails: "Smart green roof installation reducing cooling loads, purifying rainwater, and utilizing sub-surface automated capillary irrigation.",
      technicalDetails: "Sub-drainage layer: Polyethylene modular retention cells with geotextiles | Root barrier membrane | Insulation: XPS (100mm).",
    },
    {
      id: "solar-canopy",
      name: "BIPV Solar Origami Canopy",
      arabicName: "مظلة الطاقة الشمسية الديناميكية",
      x: 1, y: 3, w: 5, h: 2,
      elevation: 65,
      color: "from-zinc-500/30 to-amber-500/20",
      details: "مظلة طاقة شمسية مدمجة بالهيكل مستوحاة من فن الأوريغامي، توفر الظل التام للفضاءات وتغطي احتياجات المجمع الكهربائية بالكامل.",
      englishDetails: "Futuristic Building-Integrated Photovoltaic (BIPV) solar canopy inspired by origami folds, generating sustainable power for the villa grid.",
      technicalDetails: "BIPV cells: Monocrystalline PERC panels | Lightweight structural aluminum frame profiles | Peak capacity: 18.5 kWp.",
    },
  ];

  const roomsToDisplay = 
    activeFloor === "ground" 
      ? groundRooms 
      : activeFloor === "first" 
        ? firstRooms 
        : roofRooms;

  const currentRoom = 
    groundRooms.find(r => r.id === selectedRoomId) || 
    firstRooms.find(r => r.id === selectedRoomId) || 
    roofRooms.find(r => r.id === selectedRoomId) ||
    groundRooms[0];

  const handleRoomClick = (room: BilingualBlueprintRoom) => {
    setSelectedRoomId(room.id);
  };

  const isRtl = lang === "ar";

  return (
    <div id="blueprint-panel" className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
      
      {/* CAD Configuration Controls */}
      <div className={`lg:col-span-4 flex flex-col justify-between luxury-glass p-6 rounded-2xl relative overflow-hidden group ${isRtl ? "text-right" : "text-left"}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-zinc-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div>
          <div className={`flex items-center gap-3 mb-6 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
            <span className="p-2 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/30 shadow-inner">
              <Compass className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-white tracking-wide">{t.blueprintCtrlTitle}</h3>
              <p className="text-xs text-zinc-400 font-mono">CAD INTERACT STATION v3.5</p>
            </div>
          </div>

          {/* Toggle 2D/3D */}
          <div className="mb-6 space-y-2">
            <label className="text-xs text-zinc-400 block font-mono">{t.blueprintProjection}</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-black/60 rounded-xl border border-zinc-800/80">
              <button
                id="btn-projection-3d"
                onClick={() => setIs3D(true)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium font-sans transition-all duration-300 cursor-pointer ${is3D ? 'bg-gold-500 text-black font-semibold shadow-md' : 'text-zinc-400 hover:text-white'}`}
              >
                <Rotate3d className="w-4 h-4" />
                <span>{t.blueprintProjection3d}</span>
              </button>
              <button
                id="btn-projection-2d"
                onClick={() => setIs3D(false)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium font-sans transition-all duration-300 cursor-pointer ${!is3D ? 'bg-gold-500 text-black font-semibold shadow-md' : 'text-zinc-400 hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>{t.blueprintProjection2d}</span>
              </button>
            </div>
          </div>

          {/* Active Level Select */}
          <div className="mb-6 space-y-2">
            <label className="text-xs text-zinc-400 block font-mono">{t.blueprintLevelLabel}</label>
            <div className="flex flex-col gap-2">
              {[
                { id: "roof", title: t.levelRoof, code: "L2 - SKY GARDEN" },
                { id: "first", title: t.levelFirst, code: "L1 - EXECUTIVE LEVEL" },
                { id: "ground", title: t.levelGround, code: "GF - RECEPTION & POOL" }
              ].map((level) => (
                <button
                  key={`blueprint-level-${lang}-${level.id}`}
                  id={`btn-level-${level.id}`}
                  onClick={() => {
                    setActiveFloor(level.id as any);
                    const list = level.id === "ground" ? groundRooms : level.id === "first" ? firstRooms : roofRooms;
                    setSelectedRoomId(list[0].id);
                  }}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 relative overflow-hidden group cursor-pointer ${isRtl ? "text-right flex-row-reverse" : "text-left flex-row"} ${activeFloor === level.id ? 'bg-gold-500/10 border-gold-400 text-gold-200' : 'bg-black/20 border-zinc-800/85 text-zinc-400 hover:border-zinc-700 hover:text-white'}`}
                >
                  <div className={isRtl ? "text-left" : "text-right"}>
                    <span className="text-[10px] block font-mono tracking-wider">{level.code}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${isRtl ? "text-right flex-row-reverse" : "text-left flex-row"}`}>
                    <Layers className={`w-3.5 h-3.5 ${activeFloor === level.id ? 'text-gold-400' : 'text-zinc-500'}`} />
                    <span className="text-xs font-sans font-medium">{level.title}</span>
                  </div>
                  {activeFloor === level.id && (
                    <div className={`absolute top-0 bottom-0 w-[3px] bg-gold-400 ${isRtl ? "right-0" : "left-0"}`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Perspective Manual Override sliders */}
          {is3D && (
            <div className="space-y-4 py-4 px-3 bg-black/40 rounded-xl border border-zinc-800/80 mb-6 font-mono text-xs">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-2">{t.blueprintCalibration}</span>
              
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Pitch: {rotX}°</span>
                  <span className="text-[10px] text-gold-500/80">ROTATION-X</span>
                </div>
                <input 
                  type="range" min="10" max="65" value={rotX} 
                  onChange={(e) => setRotX(Number(e.target.value))}
                  className="w-full accent-gold-500 bg-zinc-800 h-1 rounded"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Yaw: {rotZ}°</span>
                  <span className="text-[10px] text-gold-500/80">ROTATION-Z</span>
                </div>
                <input 
                  type="range" min="-120" max="45" value={rotZ} 
                  onChange={(e) => setRotZ(Number(e.target.value))}
                  className="w-full accent-gold-500 bg-zinc-800 h-1 rounded"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Height: {elevation}px</span>
                  <span className="text-[10px] text-gold-500/80">Z-AXIS TRANSLATE</span>
                </div>
                <input 
                  type="range" min="20" max="180" value={elevation} 
                  onChange={(e) => setElevation(Number(e.target.value))}
                  className="w-full accent-gold-500 bg-zinc-800 h-1 rounded"
                />
              </div>

              <button 
                id="btn-reset-cad"
                onClick={() => { setRotX(30); setRotZ(-45); setElevation(100); }}
                className="w-full text-center text-[10px] text-gold-400/80 hover:text-gold-400 border border-gold-400/20 rounded py-1.5 transition hover:bg-gold-500/5 mt-2 cursor-pointer font-sans"
              >
                {t.blueprintReset}
              </button>
            </div>
          )}

          {/* Legend indicator */}
          <div className="flex justify-between items-center text-[11px] text-zinc-500 p-2 bg-black/20 rounded border border-zinc-950 font-mono flex-wrap gap-2">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-yellow-500/70 rounded-full inline-block animate-pulse"></span> {t.blueprintLegendSteel}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-cyan-400/70 rounded-full inline-block animate-pulse"></span> {t.blueprintLegendGlazing}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-600/70 rounded-full inline-block animate-pulse"></span> {t.blueprintLegendWood}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800/80 hidden lg:block">
          <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
            {t.blueprintFooterText}
          </p>
        </div>
      </div>

      {/* 3D Wireframe Interactive Canvas Sandbox */}
      <div className="lg:col-span-8 flex flex-col justify-between luxury-glass p-6 rounded-2xl relative overflow-hidden blueprint-grid border border-gold-500/10 min-h-[500px]">
        {/* Glow Ambient Lights */}
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 -translate-x-1/2 w-80 h-80 glow-orb-gold rounded-full pointer-events-none" />
        
        {/* Top bar with compass / structural layer specs */}
        <div className={`flex justify-between items-start z-10 index-10 flex-wrap gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
          <div className={isRtl ? "text-right" : "text-left"}>
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block">{t.blueprintTwinLabel}</span>
            <h4 className={`text-sm font-semibold text-zinc-200 mt-1 flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
              <span>
                {activeFloor === "ground" 
                  ? (isRtl ? "GF - مخطط الضيافة والمسبح" : "GF - Reception Reception & Pools Plan")
                  : activeFloor === "first" 
                    ? (isRtl ? "L1 - الفضاء السكني المعلق" : "L1 - Suspended Executive Floor")
                    : (isRtl ? "L2 - حديقة السقف الصديقة للبيئة" : "L2 - Automated Green Skyroof")}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </h4>
          </div>
          
          <div className={`flex gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
            <button
              id="btn-toggle-annotations"
              onClick={() => setShowAnnotations(!showAnnotations)}
              className={`p-2 rounded-lg border text-xs font-sans flex items-center gap-1.5 bg-black/60 transition-all duration-300 cursor-pointer ${showAnnotations ? 'text-gold-400 border-gold-500/40' : 'text-zinc-500 border-zinc-800'}`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>{showAnnotations ? t.blueprintHideDim : t.blueprintShowDim}</span>
            </button>
            <div className="p-2 rounded-lg bg-black/60 border border-zinc-800 text-gold-400 text-xs font-mono flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-gold-400 animate-bounce" />
              <span>BIM LIVE CONNECT</span>
            </div>
          </div>
        </div>

        {/* The 3D/2D Blueprint Wireframe Sandbox */}
        <div className="my-8 flex items-center justify-center min-h-[300px] relative">
          
          {/* Outer perspective wrapper */}
          <div 
            style={{ 
              perspective: is3D ? "1200px" : "none",
              perspectiveOrigin: "50% 50%",
              width: "100%",
            }} 
            className="flex items-center justify-center transition-all duration-500"
          >
            {/* The canvas table rotating */}
            <div
              style={{
                transform: is3D 
                  ? `rotateX(${rotX}deg) rotateZ(${rotZ}deg)` 
                  : "rotateX(0deg) rotateZ(0deg)",
                transformStyle: "preserve-3d",
              }}
              className="relative w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] grid grid-cols-6 grid-rows-6 gap-2 sm:gap-3 p-4 bg-zinc-950/85 rounded-3xl border-2 border-zinc-800/85 transition-all duration-500 shadow-[0_30px_70px_rgba(0,0,0,0.8)]"
            >
              
              {/* Drafting grid coordinate lines backdrop */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:16.666%_16.666%] opacity-40 rounded-3xl" />
              
              {/* Outer Wireframe bounds */}
              {is3D && (
                <div 
                  style={{
                    transform: `translateZ(${elevation / 2}px)`,
                    transformStyle: "preserve-3d",
                  }}
                  className="absolute inset-0 border-2 border-dashed border-zinc-700/30 opacity-40 rounded-3xl pointer-events-none"
                >
                  <div className="absolute -top-1 -left-1 text-[8px] font-mono text-zinc-500 font-bold">X-PLANE</div>
                  <div className="absolute -bottom-1 -right-1 text-[8px] font-mono text-zinc-500 font-bold">Y-PLANE</div>
                </div>
              )}

              {/* Render dynamic spatial Rooms */}
              {roomsToDisplay.map((room) => {
                const isSelected = selectedRoomId === room.id;
                
                const gridStyle = {
                  gridColumn: `${room.x} / span ${room.w}`,
                  gridRow: `${room.y} / span ${room.h}`,
                  transform: is3D 
                    ? `translateZ(${isSelected ? elevation + 20 : elevation}px)` 
                    : "translateZ(0px)",
                  transformStyle: "preserve-3d" as const,
                };

                const roomName = isRtl ? room.arabicName : room.name;

                return (
                  <button
                    key={`blueprint-room-${lang}-${room.id}`}
                    id={`blueprint-room-${room.id}`}
                    onClick={() => handleRoomClick(room)}
                    style={gridStyle}
                    className={`relative rounded-xl border-2 p-3 text-right flex flex-col justify-between transition-all duration-500 cursor-pointer group/room overflow-hidden ${isSelected 
                      ? 'bg-zinc-900 border-gold-400 shadow-[0_5px_22px_rgba(175,134,41,0.4)] text-white' 
                      : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-950/80 hover:text-zinc-200'}`}
                  >
                    
                    {/* Glowing effect inside Room */}
                    <div className={`absolute inset-0 bg-gradient-to-tr ${room.color} opacity-60 pointer-events-none transition-opacity duration-300 group-hover/room:opacity-80`} />

                    {/* Room depth sides (3D isometric walls effect) */}
                    {is3D && (
                      <div className="absolute pointer-events-none" style={{ transformStyle: "preserve-3d" }}>
                        {/* Front Wall */}
                        <div 
                          style={{
                            transform: `rotateX(-90deg) translateZ(10px) translateY(${isSelected ? -10 : 0}px)`,
                            height: `${isSelected ? '35px' : '25px'}`,
                            width: "100%"
                          }} 
                          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${isSelected ? 'from-gold-600/50 to-gold-400/20 border-b-2 border-gold-500' : 'from-zinc-800/40 to-zinc-900/10 border-b border-zinc-700/20'} origin-bottom`}
                        />
                      </div>
                    )}

                    {/* Top annotations */}
                    <div className={`relative z-10 flex justify-between items-start ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                      <span className="text-[9px] font-mono bg-black/60 px-1 py-0.5 rounded text-gold-300 border border-gold-500/20">
                        {room.id === "infinity-pool" ? "STRUCTURAL" : room.id === "glass-bridge" ? "CANTILEVER" : "WALL_H-2.8m"}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 font-bold">
                        {room.w}x{room.h}m
                      </span>
                    </div>

                    {/* Room Titles */}
                    <div className={`relative z-10 mt-auto ${isRtl ? "text-right" : "text-left"}`}>
                      <h5 className="text-[11px] sm:text-xs font-semibold leading-tight font-display tracking-tight break-all">
                        {roomName}
                      </h5>
                      {showAnnotations && (
                        <p className="text-[8px] sm:text-[9px] font-mono text-zinc-400 block mt-0.5 opacity-80 uppercase tracking-widest leading-none">
                          {isRtl ? room.name : room.arabicName}
                        </p>
                      )}
                    </div>

                    {/* Laser structural crosshair vectors on hover */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border border-zinc-700/20 rounded-full opacity-0 scale-50 transition-all group-hover/room:opacity-100 group-hover/room:scale-100 pointer-events-none" />
                  </button>
                );
              })}

            </div>
          </div>

          {/* Compass / Level indicator overlay inside the 3D grid */}
          <div className={`absolute bottom-1 bg-black/80 backdrop-blur-md p-3 rounded-xl border border-zinc-800/80 z-20 flex items-center gap-3 ${isRtl ? "right-2 flex-row-reverse text-right" : "left-2 flex-row text-left"}`}>
            <Compass className="w-6 h-6 text-gold-400 animate-spin" style={{ animationDuration: '24s' }} />
            <div className="font-mono text-[10px]">
              <span className="text-zinc-500 block uppercase">{isRtl ? "دوران محوري / الاتجاهات" : "AXIAL ROTATION / COMPASS"}</span>
              <span className="text-white font-semibold">TILT: {rotX}° | S-YAW: {rotZ}°</span>
            </div>
          </div>
        </div>

        {/* Selected Room Specs Terminal */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`blueprint-terminal-${lang}-${currentRoom.id}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="z-10 index-10 bg-zinc-950/90 border border-gold-500/20 rounded-xl p-4 sm:p-5 relative"
          >
            <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-transparent via-gold-400/80 to-transparent" />
            <div className={`absolute top-3 flex gap-1 items-center ${isRtl ? "left-4" : "right-4"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
              <span className="font-mono text-[9px] text-zinc-500 font-bold">STRUCTURAL ANALYSIS</span>
            </div>
            
            <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 items-center ${isRtl ? "text-right" : "text-left"}`}>
              <div className={`md:col-span-3 ${isRtl ? "text-right" : "text-left"}`}>
                <div className={`flex items-center gap-2 mb-1 ${isRtl ? "justify-end flex-row-reverse" : "justify-start flex-row"}`}>
                  <span className="text-xs bg-gold-400/10 text-gold-400 border border-gold-400/30 px-2 py-0.5 rounded-full font-mono">
                    {isRtl ? currentRoom.name : currentRoom.arabicName}
                  </span>
                  <h4 className="font-display font-bold text-sm sm:text-base text-white">
                    {isRtl ? currentRoom.arabicName : currentRoom.name}
                  </h4>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans mb-2">
                  {isRtl ? currentRoom.details : (currentRoom.englishDetails || currentRoom.details)}
                </p>
                <div className={`flex items-center gap-1.5 text-xs text-emerald-400 font-medium ${isRtl ? "justify-end" : "justify-start"}`}>
                  {isRtl ? (
                    <>
                      <span>{t.blueprintAlertText}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{t.blueprintAlertText}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="md:col-span-1 p-3 bg-black/50 rounded-lg border border-zinc-900 font-mono text-[10px] sm:text-[11px] leading-relaxed text-zinc-400 text-left">
                <span className={`text-gold-400 font-semibold block mb-1 border-b border-zinc-800 font-sans ${isRtl ? "text-right" : "text-left"}`}>
                  {t.blueprintDimLabel}
                </span>
                <p>{currentRoom.technicalDetails}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

      </div>

    </div>
  );
}

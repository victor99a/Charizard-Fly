import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameState, Obstacle } from './types';
import { 
  GRAVITY, 
  JUMP_STRENGTH, 
  OBSTACLE_SPEED, 
  OBSTACLE_WIDTH, 
  OBSTACLE_GAP, 
  OBSTACLE_INTERVAL,
  BIRD_SIZE,
  TOTAL_LIVES,
  INVULNERABILITY_TIME,
  CHARIZARD_SPRITE,
  PIKACHU_SPRITE,
  BGM_URL
} from './constants';
import { Button } from './components/Button';

// Utility for collision detection
const checkCollision = (charY: number, obstacles: Obstacle[], gameHeight: number, gameWidth: number) => {
  const charX = gameWidth / 2 - BIRD_SIZE / 2; // Charizard is centered horizontally
  // Adjusted hitbox padding to be more forgiving visually since the sprite is bigger but irregular
  const hitBoxPadding = 12; 
  const charLeft = charX + hitBoxPadding;
  const charRight = charX + BIRD_SIZE - hitBoxPadding;
  const charTop = charY + hitBoxPadding;
  const charBottom = charY + BIRD_SIZE - hitBoxPadding;

  // Floor/Ceiling collision
  if (charY < 0 || charBottom > gameHeight) {
    return true;
  }

  for (const obs of obstacles) {
    const obsRight = obs.x + OBSTACLE_WIDTH;
    
    // Horizontal overlap
    if (charRight > obs.x && charLeft < obsRight) {
      // Vertical check (hit top rock OR hit bottom rock)
      if (charTop < obs.topHeight || charBottom > obs.topHeight + OBSTACLE_GAP) {
        return true;
      }
    }
  }
  return false;
};

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(TOTAL_LIVES);
  const [isMuted, setIsMuted] = useState(false);
  const [charY, setCharY] = useState(300);
  const [velocity, setVelocity] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [isInvulnerable, setIsInvulnerable] = useState(false);
  
  // --- Refs for Physics Loop (to avoid stale closures) ---
  const gameLoopRef = useRef<number>();
  const charYRef = useRef(300);
  const velocityRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(TOTAL_LIVES);
  const isInvulnerableRef = useRef(false);
  const lastTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // --- Audio Handling ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.volume = 0.4;
      if (gameState === GameState.PLAYING && !isMuted) {
        audioRef.current.play().catch(e => console.log("Audio play failed interaction required", e));
      } else if (gameState !== GameState.PLAYING) {
        audioRef.current.pause();
      }
    }
  }, [gameState, isMuted]);

  const toggleMute = () => {
    setIsMuted(prev => {
      if (audioRef.current) {
        audioRef.current.muted = !prev;
      }
      return !prev;
    });
  };

  // --- Game Mechanics ---

  const jump = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;
    velocityRef.current = JUMP_STRENGTH;
    setVelocity(JUMP_STRENGTH);
  }, [gameState]);

  const takeDamage = useCallback(() => {
    if (isInvulnerableRef.current) return;

    // Play damage sound logic (optional)
    
    livesRef.current -= 1;
    setLives(livesRef.current);
    
    if (livesRef.current <= 0) {
      endGame();
    } else {
      // Trigger Invulnerability
      isInvulnerableRef.current = true;
      setIsInvulnerable(true);
      
      // Reset position slightly to center to give a chance to recover
      velocityRef.current = -5; // Small hop
      
      setTimeout(() => {
        isInvulnerableRef.current = false;
        setIsInvulnerable(false);
      }, INVULNERABILITY_TIME);
    }
  }, []);

  const endGame = () => {
    setGameState(GameState.GAME_OVER);
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
      localStorage.setItem('charizard_high_score', scoreRef.current.toString());
    }
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
  };

  const resetGame = () => {
    setGameState(GameState.PLAYING);
    setScore(0);
    setLives(TOTAL_LIVES);
    setCharY(300);
    setVelocity(0);
    setObstacles([]);
    setIsInvulnerable(false);
    
    // Reset Refs
    scoreRef.current = 0;
    livesRef.current = TOTAL_LIVES;
    charYRef.current = 300;
    velocityRef.current = 0;
    obstaclesRef.current = [];
    isInvulnerableRef.current = false;
    lastTimeRef.current = performance.now();
  };

  const getContainerDimensions = () => {
    if (gameContainerRef.current) {
      return {
        width: gameContainerRef.current.clientWidth,
        height: gameContainerRef.current.clientHeight
      };
    }
    return { width: 400, height: 600 };
  };

  // --- Game Loop ---
  const update = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) return;
    
    const deltaTime = time - lastTimeRef.current;
    // Cap delta time to prevent huge jumps if tab is inactive
    const dt = Math.min(deltaTime, 32) / 16.66; 
    lastTimeRef.current = time;

    const { height: containerHeight, width: containerWidth } = getContainerDimensions();

    // 1. Physics
    velocityRef.current += GRAVITY * dt;
    charYRef.current += velocityRef.current * dt;

    // 2. Obstacles
    // Move existing
    obstaclesRef.current = obstaclesRef.current.map(obs => ({
      ...obs,
      x: obs.x - OBSTACLE_SPEED * dt
    }));

    // Remove off-screen
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + OBSTACLE_WIDTH > -100);

    // Spawn new
    const lastObstacle = obstaclesRef.current[obstaclesRef.current.length - 1];
    if (!lastObstacle || (containerWidth - lastObstacle.x > OBSTACLE_INTERVAL)) {
      const minHeight = 80;
      const maxHeight = containerHeight - OBSTACLE_GAP - minHeight;
      const randomHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
      
      obstaclesRef.current.push({
        id: Date.now(),
        x: containerWidth + 50,
        topHeight: randomHeight,
        width: OBSTACLE_WIDTH,
        passed: false
      });
    }

    // 3. Collision
    if (checkCollision(charYRef.current, obstaclesRef.current, containerHeight, containerWidth)) {
       takeDamage();
    }

    // 4. Scoring
    obstaclesRef.current.forEach(obs => {
      if (!obs.passed && obs.x + OBSTACLE_WIDTH < (containerWidth / 2 - BIRD_SIZE / 2)) {
        obs.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
      }
    });

    // 5. Sync State for Render
    setCharY(charYRef.current);
    setVelocity(velocityRef.current);
    setObstacles([...obstaclesRef.current]);

    gameLoopRef.current = requestAnimationFrame(update);
  }, [gameState, takeDamage]);


  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      lastTimeRef.current = performance.now();
      gameLoopRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, update]);

  // --- Input Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (gameState === GameState.START || gameState === GameState.GAME_OVER) {
          // Optional: Press space to start/restart
          if(gameState === GameState.GAME_OVER) resetGame();
        } else {
          jump();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, jump]);

  useEffect(() => {
    const saved = localStorage.getItem('charizard_high_score');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- Components for Screens ---

  const IntroModal = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl border-4 border-yellow-400 text-center relative overflow-hidden">
        <div className="flex justify-center mb-4">
            <img src={PIKACHU_SPRITE} alt="Pikachu" className="w-32 h-32 animate-bounce drop-shadow-lg" />
        </div>
        <h1 className="text-xl font-bold mb-2 font-pixel text-slate-800">¡Hola Entrenador!</h1>
        <div className="text-left text-sm text-slate-600 bg-slate-100 p-4 rounded-lg mb-6 space-y-2">
            <p>⚡ Soy <strong>Pikachu</strong>.</p>
            <p>🌋 Ayuda a <strong>Charizard</strong> a cruzar el volcán.</p>
            <p>⌨️ Usa <strong>ESPACIO</strong> o toca la pantalla para volar.</p>
            <p>❤️ Tienes <strong>3 Vidas</strong>. ¡Cuidado con las rocas!</p>
        </div>
        <Button onClick={resetGame} className="w-full text-lg">
          ¡VAMOS! ▶
        </Button>
      </div>
    </motion.div>
  );

  const GameOverModal = () => {
    let message = "";
    let subMessage = "";

    // Chilean Localization logic 🇨🇱
    if (score < 5) {
      message = "¡Te falta práctica, Rey!";
      subMessage = "¡Pura moda no más! 📉";
    } else if (score < 15) {
      message = "¡Bien jugado, compadre!";
      subMessage = "Pero puedes dar más. 💪";
    } else {
      message = "¡Te las mandaste!";
      subMessage = "¡Seco para el vuelo! 🏆";
    }

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      >
        <div className="bg-slate-900 rounded-xl p-8 max-w-sm w-full shadow-2xl border-4 border-red-500 text-center">
            <h2 className="text-3xl font-pixel text-red-500 mb-2">GAME OVER</h2>
            
            <div className="my-6">
                <div className="text-6xl font-bold text-white mb-2">{score}</div>
                <div className="text-yellow-400 text-sm font-pixel uppercase">Puntaje</div>
            </div>

            <div className="mb-8">
                <p className="text-white text-lg font-bold mb-1">{message}</p>
                <p className="text-slate-400 italic">{subMessage}</p>
            </div>

            <div className="flex flex-col gap-3">
                <Button onClick={resetGame} variant="primary">
                    Reintentar 🔄
                </Button>
                <div className="text-slate-500 text-xs mt-2">
                   MEJOR PUNTAJE: {highScore}
                </div>
            </div>
        </div>
      </motion.div>
    );
  };

  const HUD = () => (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-40 pointer-events-none">
      {/* Lives */}
      <div className="flex gap-1">
        {[...Array(TOTAL_LIVES)].map((_, i) => (
          <motion.div 
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: i < lives ? 1 : 0.5, opacity: i < lives ? 1 : 0.3, filter: i < lives ? 'grayscale(0)' : 'grayscale(1)' }}
            className="text-2xl drop-shadow-md"
          >
            ❤️
          </motion.div>
        ))}
      </div>
      
      {/* Score */}
      <div className="flex flex-col items-end">
         <div className="text-4xl font-pixel text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
             {score}
         </div>
         {highScore > 0 && (
             <div className="text-xs text-yellow-300 font-bold drop-shadow-md">
                 HI: {highScore}
             </div>
         )}
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen bg-neutral-900 flex items-center justify-center overflow-hidden font-sans">
      <audio ref={audioRef} src={BGM_URL} preload="auto" />
      
      {/* Game Container */}
      <div 
        ref={gameContainerRef}
        className="relative w-full max-w-md h-full sm:h-[600px] sm:rounded-2xl overflow-hidden shadow-2xl ring-8 ring-stone-900"
        onMouseDown={jump}
        onTouchStart={jump}
      >
        {/* Dynamic Background with layers */}
        {/* Layer 1: Base Gradient (Magma at bottom, Smoke at top) */}
        <div className="absolute inset-0 bg-gradient-to-t from-red-900 via-stone-800 to-slate-900" />
        
        {/* Layer 2: Ash/Stardust Animation */}
        <div className="absolute inset-0 opacity-40 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] animate-[pulse_4s_ease-in-out_infinite]"></div>
        
        {/* Layer 3: Distant Volcano Glow */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-orange-600/30 to-transparent pointer-events-none"></div>

        {/* Game World */}
        <div className="relative w-full h-full">
            
            {/* Charizard - BIGGER and CENTERED */}
            <motion.img 
              src={CHARIZARD_SPRITE} 
              alt="Charizard" 
              className="absolute left-1/2 w-16 h-16 z-30 object-contain drop-shadow-[0_0_15px_rgba(255,165,0,0.6)]"
              style={{
                marginLeft: `-${BIRD_SIZE / 2}px`, // Center using constant
                top: charY,
                rotate: Math.min(Math.max(velocity * 2, -25), 25), // Tilt based on velocity
                opacity: isInvulnerable ? 0.5 : 1, // Blink effect
              }}
              animate={isInvulnerable ? { opacity: [0.4, 1, 0.4] } : {}}
              transition={isInvulnerable ? { repeat: Infinity, duration: 0.2 } : {}}
            />

            {/* Obstacles with Magma Visuals */}
            {obstacles.map(obs => (
              <React.Fragment key={obs.id}>
                {/* Top Column (Stalactite) */}
                <div 
                  className="absolute z-20 overflow-hidden"
                  style={{
                    left: obs.x,
                    top: 0,
                    width: obs.width,
                    height: obs.topHeight,
                    // Jagged rocky shape using clip-path could be added here, but staying rectangular for clean collision
                  }}
                >
                    {/* Rock Texture & Lighting */}
                    <div className="w-full h-full bg-stone-900 border-x-4 border-b-4 border-stone-950 relative">
                        {/* Highlights */}
                        <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_12px)]"></div>
                        {/* Glow at the tip */}
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-orange-500/50 to-transparent"></div>
                    </div>
                </div>

                {/* Bottom Column (Stalagmite) */}
                <div 
                  className="absolute z-20 overflow-hidden"
                  style={{
                    left: obs.x,
                    top: obs.topHeight + OBSTACLE_GAP,
                    width: obs.width,
                    bottom: 0,
                  }}
                >
                    <div className="w-full h-full bg-stone-900 border-x-4 border-t-4 border-stone-950 relative">
                        {/* Highlights */}
                        <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_12px)]"></div>
                        {/* Glow at the tip */}
                        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-orange-500/50 to-transparent"></div>
                    </div>
                </div>
              </React.Fragment>
            ))}
        </div>

        {/* UI Overlay */}
        <HUD />

        {/* Mute Button */}
        <button 
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className="absolute bottom-4 left-4 z-40 bg-black/50 p-2 rounded-full text-white hover:bg-black/70 transition-colors border border-white/20"
        >
            {isMuted ? '🔇' : '🔊'}
        </button>

        {/* Screens */}
        <AnimatePresence>
            {gameState === GameState.START && <IntroModal />}
            {gameState === GameState.GAME_OVER && <GameOverModal />}
        </AnimatePresence>
      </div>
      
      {/* Desktop Helper Text */}
      <div className="fixed bottom-4 text-slate-500 text-xs hidden sm:block">
         Press SPACE to fly
      </div>
    </div>
  );
};

export default App;
import React from 'react';
import { Html, Line } from '@react-three/drei';
import { useProjectStore } from '../../store/useProjectStore';
import { RoomObstacle } from '../../types/woodcraft';

export const RoomContextMesh: React.FC = () => {
  const room = useProjectStore((s) => s.room);
  const unitMode = useProjectStore((s) => s.unitMode);

  if (!room.enabled) return null;

  const fmt = (mm: number) =>
    unitMode === 'cm' ? `${(mm / 10).toFixed(1)} ס"מ` : `${Math.round(mm)} מ"מ`;

  const halfW = room.width / 2;
  const halfD = room.depth / 2;
  const H = room.height;
  const wallThick = 24;

  const computeObstacleTransform = (obs: RoomObstacle) => {
    const cxLocal = obs.offsetX + obs.width / 2;
    const cy = obs.offsetY + obs.height / 2;

    if (obs.wall === 'back') {
      return {
        position: [-halfW + cxLocal, cy, -halfD + obs.depth / 2] as [
          number,
          number,
          number
        ],
        rotation: [0, 0, 0] as [number, number, number],
      };
    } else if (obs.wall === 'left') {
      return {
        position: [-halfW + obs.depth / 2, cy, -halfD + cxLocal] as [
          number,
          number,
          number
        ],
        rotation: [0, Math.PI / 2, 0] as [number, number, number],
      };
    } else {
      return {
        position: [halfW - obs.depth / 2, cy, -halfD + cxLocal] as [
          number,
          number,
          number
        ],
        rotation: [0, -Math.PI / 2, 0] as [number, number, number],
      };
    }
  };

  return (
    <group name="room-environment">
      {/* Room floor boundary outline */}
      <Line
        points={[
          [-halfW, 1, -halfD],
          [halfW, 1, -halfD],
          [halfW, 1, halfD],
          [-halfW, 1, halfD],
          [-halfW, 1, -halfD],
        ]}
        color="#38bdf8"
        lineWidth={1.8}
        dashed
        dashScale={0.05}
      />

      {/* Back Wall (Z = -halfD) */}
      {room.showBackWall && (
        <group>
          <mesh
            position={[0, H / 2, -halfD - wallThick / 2]}
            receiveShadow
          >
            <boxGeometry args={[room.width, H, wallThick]} />
            <meshStandardMaterial
              color="#cbd5e1"
              transparent
              opacity={0.45}
              roughness={0.9}
            />
          </mesh>
          {room.showBaseboard && (
            <mesh
              position={[
                0,
                room.baseboardHeight / 2,
                -halfD + room.baseboardThickness / 2,
              ]}
            >
              <boxGeometry
                args={[
                  room.width,
                  room.baseboardHeight,
                  room.baseboardThickness,
                ]}
              />
              <meshStandardMaterial color="#94a3b8" roughness={0.6} />
            </mesh>
          )}
          <Html position={[0, H + 70, -halfD]} center>
            <div className="bg-white/95 text-slate-700 border border-slate-300 shadow-xs px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold whitespace-nowrap pointer-events-none">
              קיר אחורי: {fmt(room.width)} × {fmt(H)}
            </div>
          </Html>
        </group>
      )}

      {/* Left Wall (X = -halfW) */}
      {room.showLeftWall && (
        <group>
          <mesh
            position={[-halfW - wallThick / 2, H / 2, 0]}
            receiveShadow
          >
            <boxGeometry args={[wallThick, H, room.depth]} />
            <meshStandardMaterial
              color="#cbd5e1"
              transparent
              opacity={0.4}
              roughness={0.9}
            />
          </mesh>
          {room.showBaseboard && (
            <mesh
              position={[
                -halfW + room.baseboardThickness / 2,
                room.baseboardHeight / 2,
                0,
              ]}
            >
              <boxGeometry
                args={[
                  room.baseboardThickness,
                  room.baseboardHeight,
                  room.depth,
                ]}
              />
              <meshStandardMaterial color="#94a3b8" roughness={0.6} />
            </mesh>
          )}
          <Html position={[-halfW, H + 70, 0]} center>
            <div className="bg-white/95 text-slate-700 border border-slate-300 shadow-xs px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold whitespace-nowrap pointer-events-none">
              קיר שמאל: {fmt(room.depth)}
            </div>
          </Html>
        </group>
      )}

      {/* Right Wall (X = +halfW) */}
      {room.showRightWall && (
        <group>
          <mesh
            position={[halfW + wallThick / 2, H / 2, 0]}
            receiveShadow
          >
            <boxGeometry args={[wallThick, H, room.depth]} />
            <meshStandardMaterial
              color="#cbd5e1"
              transparent
              opacity={0.4}
              roughness={0.9}
            />
          </mesh>
          {room.showBaseboard && (
            <mesh
              position={[
                halfW - room.baseboardThickness / 2,
                room.baseboardHeight / 2,
                0,
              ]}
            >
              <boxGeometry
                args={[
                  room.baseboardThickness,
                  room.baseboardHeight,
                  room.depth,
                ]}
              />
              <meshStandardMaterial color="#94a3b8" roughness={0.6} />
            </mesh>
          )}
          <Html position={[halfW, H + 70, 0]} center>
            <div className="bg-white/95 text-slate-700 border border-slate-300 shadow-xs px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold whitespace-nowrap pointer-events-none">
              קיר ימין: {fmt(room.depth)}
            </div>
          </Html>
        </group>
      )}

      {/* Wall Obstacles (Windows, Doors, Outlets, Radiators) */}
      {room.obstacles.map((obs) => {
        if (obs.wall === 'back' && !room.showBackWall) return null;
        if (obs.wall === 'left' && !room.showLeftWall) return null;
        if (obs.wall === 'right' && !room.showRightWall) return null;

        const { position, rotation } = computeObstacleTransform(obs);
        const isWindow = obs.type === 'window';
        const isOutlet = obs.type === 'outlet';
        const isDoor = obs.type === 'door';

        const color = isWindow
          ? '#38bdf8'
          : isOutlet
          ? '#facc15'
          : isDoor
          ? '#a16207'
          : '#f87171';

        return (
          <group key={obs.id} position={position} rotation={rotation}>
            <mesh>
              <boxGeometry args={[obs.width, obs.height, obs.depth]} />
              <meshStandardMaterial
                color={color}
                transparent={isWindow}
                opacity={isWindow ? 0.45 : 0.85}
                roughness={isWindow ? 0.2 : 0.6}
              />
            </mesh>
            <Html position={[0, 0, obs.depth / 2 + 10]} center>
              <div className="bg-white/95 text-slate-800 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap shadow-xs pointer-events-none">
                {obs.name} ({fmt(obs.width)}×{fmt(obs.height)})
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
